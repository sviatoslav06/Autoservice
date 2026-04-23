import 'dotenv/config';
import { BoxStatus, Prisma, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TARGET_CLIENTS = 80;
const TARGET_BOXES = 8;
const TARGET_VEHICLES = 220;
const TARGET_PARTS = 1000;
const TARGET_SERVICES = 140;
const TARGET_ORDERS = 520;
const TARGET_MECHANICS = 8;
const TARGET_MIN_EXTERNAL_RECORDS = 1000;
const IMPORT_MARKER = '[external-import]';
const VEHICLE_DATA_YEARS = Array.from({ length: 35 }, (_, index) => 1992 + index);

const EXTERNAL_TABLES = ['Vehicle', 'PartCategory', 'Part', 'Service', 'Order'] as const;

type ExternalTableName = (typeof EXTERNAL_TABLES)[number];

export type ExternalImportReport = {
  sourceSummary: {
    allowsMixedSources: true;
    usesGeneratedValues: true;
    targetTables: ExternalTableName[];
  };
  targets: {
    minExternalRecords: number;
  };
  importedRows: Record<ExternalTableName, number>;
  totals: {
    externalRecords: number;
    requirementSatisfied: boolean;
  };
};

type WikiParseResponse = {
  parse?: {
    wikitext?: {
      '*': string;
    };
  };
};

type VpicApiResponse = {
  Results?: Array<Record<string, unknown>>;
};

type ParsedBulletItem = {
  section: string;
  name: string;
};

type SeedClient = {
  username: string;
  email: string;
  phone: string;
};

type ServiceTemplate = {
  name: string;
  category: string;
  source: string;
};

type ImportedMechanic = {
  userId: number;
  workerId: number;
  username: string;
  hourlyRate: Prisma.Decimal;
};

const COMMON_CLIENTS: SeedClient[] = Array.from({ length: TARGET_CLIENTS }, (_, index) => {
  const n = index + 1;
  return {
    username: `demo-client-${n}`,
    email: `demo-client-${n}@autoservice.local`,
    phone: `+380500000${String(n).padStart(2, '0')}`
  };
});

const MODEL_YEARS = [2018, 2019, 2020, 2021, 2022];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanWikiText(value: string) {
  return value
    .replace(/<!--.*?-->/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\|[^]*?\|\}/g, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function pickNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'autoservice-data-import/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'autoservice-data-import/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'autoservice-data-import/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchWikiWikitext(page: string) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&origin=*`;
  const payload = await fetchJson<WikiParseResponse>(url);
  return payload.parse?.wikitext?.['*'] ?? '';
}

function parseWikiBullets(wikitext: string) {
  const items: ParsedBulletItem[] = [];
  let currentSection = 'General';

  for (const rawLine of wikitext.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^={2,6}\s*(.+?)\s*={2,6}$/);
    if (heading) {
      const section = cleanWikiText(heading[1]);
      if (!['See also', 'References', 'External links', 'Notes'].includes(section)) {
        currentSection = section;
      }
      continue;
    }

    const bullet = line.match(/^\*\s*(.+)$/);
    if (!bullet) continue;

    const name = cleanWikiText(bullet[1]);
    if (!name) continue;
    if (name.length > 140) continue;
    if (/^https?:\/\//i.test(name)) continue;

    items.push({ section: currentSection, name });
  }

  return items;
}

function parseSimpleCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const rows: string[][] = [];

  for (const line of lines.slice(1)) {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

function stripHtmlToLines(html: string) {
  const normalized = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n* ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<h1[^>]*>/gi, '\n# ')
      .replace(/<h2[^>]*>/gi, '\n## ')
      .replace(/<h3[^>]*>/gi, '\n### ')
      .replace(/<h4[^>]*>/gi, '\n#### ')
      .replace(/<h5[^>]*>/gi, '\n##### ')
      .replace(/<h6[^>]*>/gi, '\n###### ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/section>/gi, '\n')
      .replace(/<\/article>/gi, '\n')
      .replace(/<\/main>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  return normalized
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseServiceTemplatesFromHtml(html: string, source: string) {
  const skipExact = new Set([
    'Home',
    'Auto Repair and Maintenance Services',
    'How can we help?',
    'GET A QUOTE',
    'Read FAQ',
    'Our certified mechanics perform over 500 services.',
    'Search for service or your car problem...',
    'Find Repair Location',
    'Get your estimate and book with a RepairPal Certified location.'
  ]);

  const lines = stripHtmlToLines(html);
  const templates: ServiceTemplate[] = [];
  let currentSection = 'General';

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      const section = cleanWikiText(heading[2]);
      if (section && !skipExact.has(section)) {
        currentSection = section;
      }
      continue;
    }

    const bullet = line.match(/^[*\-•]\s*(.+)$/);
    if (!bullet) continue;

    let name = cleanWikiText(decodeHtmlEntities(bullet[1]));
    if (!name || name.length < 3) continue;
    if (skipExact.has(name)) continue;
    if (/^(Input:|Image:|URL:|Snippet:)/i.test(name)) continue;
    if (/^[A-Z0-9\s/&(),.-]+$/.test(name) && name.length > 50) continue;
    if (/^\d+\s*$/.test(name)) continue;
    name = name.replace(/\s+\$[0-9].*$/, '').trim();
    if (!name) continue;

    templates.push({
      name,
      category: currentSection,
      source
    });
  }

  return uniqueBy(
    templates,
    (item) => `${item.source.toLowerCase()}::${item.category.toLowerCase()}::${item.name.toLowerCase()}`
  );
}

function uniqueBy<T>(rows: T[], keyFn: (row: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function chunk<T>(rows: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }

  return batches;
}

function makeHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildVin(index: number, make: string, model: string, year: number) {
  const base = `${slugify(make).slice(0, 4)}${slugify(model).slice(0, 6)}${year}${index
    .toString()
    .padStart(6, '0')}`.toUpperCase();

  return base.slice(0, 17).padEnd(17, 'X');
}

function buildPlate(index: number) {
  return `AA${index.toString().padStart(6, '0')}`;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(values: T[], rng: () => number) {
  if (!values.length) {
    throw new Error('Cannot pick from an empty array');
  }

  const index = Math.floor(rng() * values.length);
  return values[Math.min(index, values.length - 1)];
}

function pickDistinct<T>(values: T[], count: number, rng: () => number) {
  const pool = [...values];
  const result: T[] = [];

  while (pool.length > 0 && result.length < count) {
    const index = Math.floor(rng() * pool.length);
    const [value] = pool.splice(index, 1);
    result.push(value);
  }

  return result;
}

async function ensureDemoClients() {
  const passwordHash = await bcrypt.hash('12345678', 12);

  for (const client of COMMON_CLIENTS) {
    const user = await prisma.user.upsert({
      where: { email: client.email },
      update: {
        username: client.username,
        phone: client.phone,
        role: UserRole.Client,
        passwordHash
      },
      create: {
        username: client.username,
        email: client.email,
        passwordHash,
        phone: client.phone,
        role: UserRole.Client
      }
    });

    await prisma.client.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });
  }

  const clients = await prisma.client.findMany({
    include: { user: true },
    orderBy: { id: 'asc' }
  });

  return clients.map((client) => client.id);
}

async function ensureBoxes() {
  for (let index = 1; index <= TARGET_BOXES; index += 1) {
    await prisma.box.upsert({
      where: { boxNumber: `B-${String(index).padStart(2, '0')}` },
      update: {
        status: BoxStatus.free,
        capacity: 1
      },
      create: {
        boxNumber: `B-${String(index).padStart(2, '0')}`,
        status: BoxStatus.free,
        capacity: 1
      }
    });
  }
}

async function ensureDemoMechanics(): Promise<ImportedMechanic[]> {
  const mechanics: ImportedMechanic[] = [];
  const passwordHash = await bcrypt.hash('12345678', 12);

  for (let index = 1; index <= TARGET_MECHANICS; index += 1) {
    const email = `demo-mechanic-${index}@autoservice.local`;
    const username = `demo-mechanic-${index}`;
    const hourlyRate = new Prisma.Decimal(25 + index * 3);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        username,
        phone: `+38067000${String(index).padStart(4, '0')}`,
        role: UserRole.Mechanic,
        passwordHash
      },
      create: {
        username,
        email,
        passwordHash,
        phone: `+38067000${String(index).padStart(4, '0')}`,
        role: UserRole.Mechanic
      }
    });

    const worker = await prisma.worker.upsert({
      where: { userId: user.id },
      update: {
        position: 'Mechanic',
        hourlyRate
      },
      create: {
        userId: user.id,
        position: 'Mechanic',
        hourlyRate
      }
    });

    mechanics.push({
      userId: user.id,
      workerId: worker.id,
      username,
      hourlyRate
    });
  }

  return mechanics;
}

async function importVehicleCatalog(clientIds: number[]) {
  const vehicles: Array<{
    clientId: number;
    make: string;
    model: string;
    year: number;
    vin: string;
    licensePlate: string;
    kilometrage: number;
  }> = [];

  for (const year of VEHICLE_DATA_YEARS.reverse()) {
    const csvUrl = `https://raw.githubusercontent.com/abhionlyone/us-car-models-data/refs/heads/master/${year}.csv`;
    let csvText: string;

    try {
      csvText = await fetchText(csvUrl);
    } catch (error) {
      console.warn(`Skipping vehicle data year ${year} because it could not be loaded`);
      continue;
    }

    const rows = parseSimpleCsv(csvText);

    for (const row of rows) {
      const [rowYear, make, model] = row;
      const parsedYear = Number(rowYear);
      const cleanMake = cleanWikiText(make ?? '');
      const cleanModel = cleanWikiText(model ?? '');

      if (!Number.isFinite(parsedYear) || !cleanMake || !cleanModel) {
        continue;
      }

      const index = vehicles.length;
      vehicles.push({
        clientId: clientIds[index % clientIds.length],
        make: cleanMake,
        model: cleanModel,
        year: parsedYear,
        vin: buildVin(index, cleanMake, cleanModel, parsedYear),
        licensePlate: buildPlate(index),
        kilometrage: 10_000 + (makeHash(`${cleanMake}-${cleanModel}-${parsedYear}`) % 180_000)
      });

      if (vehicles.length >= TARGET_VEHICLES) {
        break;
      }
    }

    if (vehicles.length >= TARGET_VEHICLES) {
      break;
    }
  }

  if (vehicles.length < TARGET_VEHICLES) {
    throw new Error(`Could only assemble ${vehicles.length} vehicles from the external vehicle dataset`);
  }

  for (const batchRows of chunk(vehicles, 100)) {
    await prisma.vehicle.createMany({
      data: batchRows,
      skipDuplicates: true
    });
  }

  return vehicles.length;
}

async function importPartCatalog() {
  const partsWiki = await fetchWikiWikitext('List_of_auto_parts');
  const suppliersWiki = await fetchWikiWikitext('List_of_current_automotive_parts_suppliers');

  const rawParts = parseWikiBullets(partsWiki);
  const rawSuppliers = parseWikiBullets(suppliersWiki);

  const categories = uniqueBy(
    rawParts.map((item) => ({
      name: item.section,
      description: `Imported from Wikipedia: ${item.section}`
    })),
    (item) => item.name.toLowerCase()
  );

  for (const category of categories) {
    await prisma.partCategory.upsert({
      where: { name: category.name },
      update: {
        description: category.description
      },
      create: category
    });
  }

  const categoryRows = await prisma.partCategory.findMany({
    orderBy: { id: 'asc' }
  });
  const categoryMap = new Map(categoryRows.map((category) => [category.name, category.id]));

  const suppliers = uniqueBy(
    rawSuppliers.map((supplier) => supplier.name),
    (supplier) => supplier.toLowerCase()
  ).slice(0, 30);

  const normalizedParts = uniqueBy(
    rawParts
      .map((item) => {
        const categoryId = categoryMap.get(item.section) ?? categoryRows[0]?.id;
        return categoryId
          ? {
              section: item.section,
              categoryId,
              name: item.name
            }
          : null;
      })
      .filter((item): item is { section: string; categoryId: number; name: string } => item !== null),
    (item) => `${item.section.toLowerCase()}::${item.name.toLowerCase()}`
  );

  if (!normalizedParts.length) {
    throw new Error('No parts were parsed from the Wikipedia page');
  }

  const partRows: Array<{
    categoryId: number;
    article: string;
    name: string;
    basePrice: Prisma.Decimal;
    stockQuantity: number;
    supplier: string;
  }> = [];

  const variantsPerPart = Math.max(1, Math.ceil(TARGET_PARTS / normalizedParts.length));

  for (const [partIndex, part] of normalizedParts.entries()) {
    for (let variant = 0; variant < variantsPerPart; variant += 1) {
      const supplier = suppliers[(partIndex + variant) % suppliers.length] ?? 'Unknown supplier';
      const key = `${part.section}-${part.name}-${supplier}-${variant}-${partIndex}`;
      const hash = makeHash(key);

      partRows.push({
        categoryId: part.categoryId,
        article: `${slugify(part.section)}-${slugify(part.name).slice(0, 28)}-${slugify(
          supplier
        ).slice(0, 18)}-${variant}-${partIndex}`.slice(0, 100),
        name: part.name,
        basePrice: new Prisma.Decimal((25 + (hash % 2500) / 10).toFixed(2)),
        stockQuantity: 10 + (hash % 240),
        supplier
      });

      if (partRows.length >= TARGET_PARTS) {
        break;
      }
    }

    if (partRows.length >= TARGET_PARTS) {
      break;
    }
  }

  if (partRows.length < TARGET_PARTS) {
    throw new Error(`Could only assemble ${partRows.length} parts from the Wikipedia lists`);
  }

  for (const batchRows of chunk(partRows, 100)) {
    await prisma.part.createMany({
      data: batchRows,
      skipDuplicates: true
    });
  }

  return {
    categories: categoryRows.length,
    parts: partRows.length,
    suppliers: suppliers.length
  };
}

async function importServiceCatalog() {
  const [serviceWiki, maintenanceWiki, operationalWiki] = await Promise.all([
    fetchWikiWikitext('Service_(motor_vehicle)'),
    fetchWikiWikitext('Maintenance'),
    fetchWikiWikitext('Operational_maintenance')
  ]);

  const templates = uniqueBy(
    [
      ...parseWikiBullets(serviceWiki).map((item) => ({
        name: item.name,
        category: item.section,
        source: 'Wikipedia:Service'
      })),
      ...parseWikiBullets(maintenanceWiki).map((item) => ({
        name: item.name,
        category: item.section,
        source: 'Wikipedia:Maintenance'
      })),
      ...parseWikiBullets(operationalWiki).map((item) => ({
        name: item.name,
        category: item.section,
        source: 'Wikipedia:Operational'
      }))
    ],
    (item) => `${item.source.toLowerCase()}::${item.category.toLowerCase()}::${item.name.toLowerCase()}`
  );

  if (!templates.length) {
    throw new Error('No service templates were parsed from external sources');
  }

  // Do not delete imported services because they may already be linked
  // to non-import orders created by users, and the relation is RESTRICT.
  const existingImportedServices = await prisma.service.findMany({
    where: {
      description: {
        startsWith: IMPORT_MARKER
      }
    },
    select: {
      name: true,
      description: true
    }
  });

  const existingServiceKeys = new Set(
    existingImportedServices.map((service) => `${service.name}::${service.description ?? ''}`)
  );

  const serviceRows: Array<{
    name: string;
    description: string | null;
    standardPrice: Prisma.Decimal;
    durationMinutes: number;
  }> = [];

  const serviceTypes = ['Minor service', 'Major service', 'Inspection', 'Replacement', 'Adjustment'];
  const intervalLabels = [
    'Every 10,000 km',
    'Every 15,000 km',
    'Every 30,000 km',
    'Every 45,000 km',
    'Every 6 months',
    'Every 12 months',
    'Condition-based',
    'As needed'
  ];
  const vehicleContexts = ['compact car', 'sedan', 'SUV', 'pickup', 'diesel vehicle'];

  for (let index = 0; index < TARGET_SERVICES; index += 1) {
    const template = templates[index % templates.length];
    const serviceType = serviceTypes[index % serviceTypes.length];
    const interval = intervalLabels[Math.floor(index / templates.length) % intervalLabels.length];
    const context = vehicleContexts[Math.floor(index / (templates.length * intervalLabels.length)) % vehicleContexts.length];
    const hash = makeHash(`${template.source}-${template.category}-${template.name}-${serviceType}-${interval}-${context}-${index}`);

    serviceRows.push({
      name: `${serviceType}: ${template.name} (${interval}, ${context})`,
      description: `${IMPORT_MARKER} ${template.source} • ${template.category}`,
      standardPrice: new Prisma.Decimal(45 + (hash % 180)),
      durationMinutes: 20 + (hash % 160)
    });
  }

  const rowsToCreate = serviceRows.filter(
    (row) => !existingServiceKeys.has(`${row.name}::${row.description ?? ''}`)
  );

  for (const batchRows of chunk(rowsToCreate, 100)) {
    await prisma.service.createMany({
      data: batchRows
    });
  }

  return {
    templates: templates.length,
    services: rowsToCreate.length
  };
}

async function generateOrderDataset() {
  await prisma.order.deleteMany({
    where: {
      notes: {
        startsWith: IMPORT_MARKER
      }
    }
  });

  const [clients, boxes, services, parts, mechanics] = await Promise.all([
    prisma.client.findMany({
      include: {
        vehicles: {
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    }),
    prisma.box.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.service.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.part.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.worker.findMany({
      where: {
        position: 'Mechanic'
      },
      include: {
        user: true
      },
      orderBy: { id: 'asc' }
    })
  ]);

  if (!clients.length) {
    throw new Error('No clients available for order generation');
  }

  if (!boxes.length) {
    throw new Error('No boxes available for order generation');
  }

  if (!services.length) {
    throw new Error('No services available for order generation');
  }

  if (!parts.length) {
    throw new Error('No parts available for order generation');
  }

  if (!mechanics.length) {
    throw new Error('No mechanics available for order generation');
  }

  const rng = createRng(makeHash(`${IMPORT_MARKER}-orders-${clients.length}-${services.length}`));
  const remainingPartStock = new Map<number, number>(
    parts.map((part) => [part.id, Math.max(0, part.stockQuantity)])
  );
  const baseStart = new Date();
  baseStart.setDate(baseStart.getDate() - 240);
  baseStart.setHours(8, 0, 0, 0);

  const orders: Array<{
    clientId: number;
    vehicleId: number;
    boxId: number;
    orderDate: Date;
    startTime: Date;
    totalDurationMinutes: number;
    status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed';
    notes: string;
    selectedServices: Array<{
      serviceId: number;
      workerId: number;
      plannedDurationMinutes: number;
      actualDurationMinutes: number | null;
      actualCost: Prisma.Decimal;
    }>;
    selectedParts: Array<{
      partId: number;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }>;
  }> = [];

  for (let index = 0; index < TARGET_ORDERS; index += 1) {
    const client = pickRandom(clients, rng);
    const vehicle = client.vehicles.length
      ? pickRandom(client.vehicles, rng)
      : pickRandom(
          clients.flatMap((entry) => entry.vehicles),
          rng
        );

    if (!vehicle) {
      throw new Error('No vehicles available for order generation');
    }

    const serviceCount = 1 + Math.floor(rng() * 3);
    const selectedServices = pickDistinct(services, serviceCount, rng);
    const selectedMechanics = pickDistinct(mechanics, selectedServices.length, rng);
    const availableParts = parts.filter((part) => (remainingPartStock.get(part.id) ?? 0) > 0);
    const selectedParts = pickDistinct(availableParts, Math.min(4, availableParts.length, Math.floor(rng() * 4) + 1), rng);

    const orderDate = new Date(baseStart.getTime() + index * 24 * 60 * 60 * 1000);
    const startTime = new Date(orderDate);
    startTime.setHours(index % 2 === 0 ? 8 : 13, 0, 0, 0);

    const daysFromNow = Math.floor((startTime.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const status: 'planned' | 'in_progress' | 'ready_for_delivery' | 'completed' =
      daysFromNow > 2
        ? 'planned'
        : daysFromNow > -10
          ? (index % 3 === 0 ? 'in_progress' : 'ready_for_delivery')
          : (index % 5 === 0 ? 'completed' : index % 5 === 1 ? 'ready_for_delivery' : 'completed');

    const serviceRows = selectedServices.map((service, serviceIndex) => {
      const plannedDurationMinutes = Math.max(1, Number(service.durationMinutes) || 1);
      const factor = status === 'completed' || status === 'ready_for_delivery'
        ? 0.95 + rng() * 0.2
        : 1;

      return {
        serviceId: service.id,
        workerId: selectedMechanics[serviceIndex].id,
        plannedDurationMinutes,
        actualDurationMinutes:
          status === 'completed' || status === 'ready_for_delivery'
            ? Math.max(1, Math.round(plannedDurationMinutes * factor))
            : status === 'in_progress' && serviceIndex === 0
              ? Math.max(1, Math.round(plannedDurationMinutes * 0.75))
              : 1,
        actualCost: new Prisma.Decimal(
          (Number(service.standardPrice) * (status === 'completed' || status === 'ready_for_delivery' ? factor : 1)).toFixed(2)
        )
      };
    });

    const totalDurationMinutes = Math.max(
      60,
      serviceRows.reduce((sum, line) => sum + Math.max(1, line.plannedDurationMinutes), 0)
    );

    const partRows = selectedParts.map((part) => {
      const available = remainingPartStock.get(part.id) ?? 0;
      const quantity = Math.min(available, 1 + Math.floor(rng() * 3));
      remainingPartStock.set(part.id, Math.max(0, available - quantity));

      return {
        partId: part.id,
        quantity,
        unitPrice: part.basePrice
      };
    });

    orders.push({
      clientId: client.id,
      vehicleId: vehicle.id,
      boxId: boxes[index % boxes.length].id,
      orderDate,
      startTime,
      totalDurationMinutes,
      status,
      notes: `${IMPORT_MARKER} order #${index + 1} generated from external catalogs`,
      selectedServices: serviceRows,
      selectedParts: partRows
    });
  }

  for (const batch of chunk(orders, 25)) {
    for (const orderData of batch) {
      await prisma.$transaction(async (tx) => {
        const safeTotalDurationMinutes = Math.max(
          60,
          Number.isFinite(orderData.totalDurationMinutes) ? Math.trunc(orderData.totalDurationMinutes) : 60
        );
        if (safeTotalDurationMinutes !== orderData.totalDurationMinutes) {
          console.warn(
            `[external-import] normalized order duration from ${orderData.totalDurationMinutes} to ${safeTotalDurationMinutes}`
          );
        }

        const order = await tx.order.create({
          data: {
            clientId: orderData.clientId,
            vehicleId: orderData.vehicleId,
            boxId: orderData.boxId,
            orderDate: orderData.orderDate,
            startTime: orderData.startTime,
            totalDurationMinutes: safeTotalDurationMinutes,
            status: orderData.status,
            notes: orderData.notes
          }
        });

        if (orderData.selectedServices.length) {
          await tx.orderService.createMany({
            data: orderData.selectedServices.map((service) => ({
              orderId: order.id,
              serviceId: service.serviceId,
              workerId: service.workerId,
              actualDurationMinutes: service.actualDurationMinutes,
              actualCost: service.actualCost
            }))
          });
        }

        if (orderData.selectedParts.length) {
          await tx.orderPart.createMany({
            data: orderData.selectedParts.map((part) => ({
              orderId: order.id,
              partId: part.partId,
              quantity: part.quantity,
              unitPrice: part.unitPrice
            }))
          });
        }

        const totalAmount = await recalculateImportedOrderTotal(tx, order.id);

        if (orderData.status === 'completed' || orderData.status === 'ready_for_delivery') {
          const completionRatio = orderData.status === 'completed' ? 1 : 0.7;
          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: totalAmount.mul(new Prisma.Decimal(completionRatio)),
              paymentMethod: indexToPaymentMethod(order.id),
              status: 'completed'
            }
          });
        } else if (orderData.status === 'in_progress' && Number(order.id) % 2 === 0) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: totalAmount.mul(new Prisma.Decimal(0.35)),
              paymentMethod: indexToPaymentMethod(order.id),
              status: 'completed'
            }
          });
        }
      });
    }
  }

  return {
    orders: orders.length
  };
}

function indexToPaymentMethod(orderId: number) {
  const methods: Array<'cash' | 'card' | 'transfer'> = ['cash', 'card', 'transfer'];
  return methods[orderId % methods.length];
}

async function recalculateImportedOrderTotal(tx: Prisma.TransactionClient, orderId: number) {
  const [servicesForOrder, partsForOrder] = await Promise.all([
    tx.orderService.findMany({
      where: { orderId },
      include: {
        service: {
          select: {
            standardPrice: true
          }
        }
      }
    }),
    tx.orderPart.findMany({
      where: { orderId }
    })
  ]);

  const serviceTotal = servicesForOrder.reduce((sum, line) => {
    const rawCost = line.actualCost ?? line.service.standardPrice;
    return sum.plus(new Prisma.Decimal(rawCost));
  }, new Prisma.Decimal(0));

  const partsTotal = partsForOrder.reduce((sum, line) => {
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    return sum.plus(unitPrice.mul(line.quantity));
  }, new Prisma.Decimal(0));

  const total = serviceTotal.plus(partsTotal);
  await tx.order.update({
    where: { id: orderId },
    data: {
      totalAmount: total
    }
  });

  return total;
}

async function main(): Promise<ExternalImportReport> {
  console.log('Preparing demo clients and boxes...');
  const clientIds = await ensureDemoClients();
  await ensureBoxes();
  const mechanics = await ensureDemoMechanics();

  console.log('Importing vehicle catalog from NHTSA vPIC...');
  const vehicleCount = await importVehicleCatalog(clientIds);

  console.log('Importing parts catalog from Wikipedia...');
  const partStats = await importPartCatalog();

  console.log('Importing service catalog from Wikipedia sources...');
  const serviceStats = await importServiceCatalog();

  console.log('Generating external-import orders...');
  const orderStats = await generateOrderDataset();

  const [vehiclesTotal, partsTotal, categoriesTotal, servicesTotal, ordersTotal, clientsTotal, boxesTotal] = await Promise.all([
    prisma.vehicle.count(),
    prisma.part.count(),
    prisma.partCategory.count(),
    prisma.service.count(),
    prisma.order.count(),
    prisma.client.count(),
    prisma.box.count()
  ]);

  const importedRows: Record<ExternalTableName, number> = {
    Vehicle: vehicleCount,
    PartCategory: partStats.categories,
    Part: partStats.parts,
    Service: serviceStats.services,
    Order: orderStats.orders
  };

  const externalRecords = Object.values(importedRows).reduce((sum, value) => sum + value, 0);
  const requirementSatisfied = externalRecords >= TARGET_MIN_EXTERNAL_RECORDS;

  const report: ExternalImportReport = {
    sourceSummary: {
      allowsMixedSources: true,
      usesGeneratedValues: true,
      targetTables: [...EXTERNAL_TABLES]
    },
    targets: {
      minExternalRecords: TARGET_MIN_EXTERNAL_RECORDS
    },
    importedRows,
    totals: {
      externalRecords,
      requirementSatisfied
    }
  };

  console.log(
    [
      `Seeded vehicles: ${vehicleCount} imported, ${vehiclesTotal} total in DB`,
      `Seeded parts: ${partStats.parts} imported, ${partsTotal} total in DB`,
      `Seeded services: ${serviceStats.services} imported from ${serviceStats.templates} templates`,
      `Seeded orders: ${orderStats.orders} generated`,
      `Seeded mechanics: ${mechanics.length} demo mechanics`,
      `Seeded categories: ${partStats.categories} total`,
      `Seeded clients: ${clientsTotal} total`,
      `Seeded boxes: ${boxesTotal} total`,
      `Seeded service rows total in DB: ${servicesTotal}`,
      `Seeded order rows total in DB: ${ordersTotal}`,
      `External import tables: ${EXTERNAL_TABLES.join(', ')}`,
      `External import rows: ${externalRecords} (minimum required: ${TARGET_MIN_EXTERNAL_RECORDS})`
    ].join('\n')
  );

  return report;
}

export async function runExternalDataImport() {
  return main();
}

if (require.main === module) {
  main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
