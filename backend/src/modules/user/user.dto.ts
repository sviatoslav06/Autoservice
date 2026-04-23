export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  phone?: string;
  role: 'Client' | 'Mechanic' | 'Manager' | 'Accountant' | 'Admin';
  hourlyRate?: number;
}

export interface CreateClientByManagerDto {
  username: string;
  phone?: string;
  email?: string;
}
