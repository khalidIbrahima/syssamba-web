// Database types
export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  nameEn?: string;
  currency: string; // ISO 4217
  currencySymbol: string;
  isActive: boolean;
  isOhada: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  type: 'agency' | 'sci' | 'syndic' | 'individual';
  country: string; // Code pays ISO 3166-1 alpha-2, référence à Country.code
  // Note: planId and limits are in subscriptions and plans tables
  extranetTenantsCount: number;
  customExtranetDomain?: string;
  stripeCustomerId?: string;
  isConfigured?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  id: string;
  organizationId?: string;
  clerkId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role: 'owner' | 'admin' | 'accountant' | 'agent' | 'viewer';
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
};

export type Property = {
  id: string;
  organizationId?: string;
  name: string;
  address: string;
  city?: string;
  propertyType?: string;
  totalUnits?: number;
  photoUrls?: string[]; // Array of photo URLs - supports multiple photos
  notes?: string;
  latitude?: string | null; // Decimal as string from database
  longitude?: string | null; // Decimal as string from database
  createdAt: Date;
};

export type Unit = {
  id: string;
  organizationId?: string;
  propertyId?: string;
  unitNumber: string;
  floor?: string;
  surface?: number;
  rentAmount: string;
  chargesAmount: string;
  depositAmount: string;
  photoUrls?: string[]; // Array of photo URLs for the unit
  status: 'vacant' | 'occupied' | 'maintenance' | 'reserved';
  createdAt: Date;
};

export type Tenant = {
  id: string;
  organizationId?: string;
  unitId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  hasExtranetAccess: boolean;
  extranetToken: string;
  language: string;
  createdAt: Date;
};

// UI types
export type DashboardStats = {
  totalRevenue: number;
  overduePayments: number;
  vacantUnits: number;
  activeTasks: number;
};

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';