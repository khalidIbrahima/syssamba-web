import { pgTable, text, uuid, boolean, integer, decimal, date, timestamp, jsonb, check, uniqueIndex, index } from 'drizzle-orm/pg-core';

// Plans table - définitions des plans disponibles
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // freemium, starter, pro, agency, enterprise
  displayName: text('display_name').notNull(), // Nom d'affichage
  price: decimal('price', { precision: 10, scale: 2 }), // null pour 'custom'
  priceType: text('price_type', { enum: ['fixed', 'custom'] }).default('fixed'),
  
  // Limites
  lotsLimit: integer('lots_limit'), // null pour illimité
  usersLimit: integer('users_limit'), // null pour illimité
  extranetTenantsLimit: integer('extranet_tenants_limit'), // null pour illimité
  
  // Features (stockées en JSONB pour flexibilité)
  features: jsonb('features').notNull().default({}),
  
  // Support
  supportLevel: text('support_level', { enum: ['community', 'email', 'priority_email', 'phone_24_7', 'dedicated_manager'] }).default('community'),
  
  // Métadonnées
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxPlansName: index('idx_plans_name').on(table.name),
}));

// Features table - defines available features
export const features = pgTable('features', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // Feature key (e.g., "properties.view")
  displayName: text('display_name').notNull(), // Human readable name
  description: text('description'), // Feature description
  category: text('category').notNull(), // Category (Core Features, Property Management, etc.)
  icon: text('icon'), // Icon name/class
  isActive: boolean('is_active').default(true), // Whether feature is active
  isPremium: boolean('is_premium').default(false), // Whether it's a premium feature
  isBeta: boolean('is_beta').default(false), // Whether it's in beta
  requiredPlan: text('required_plan'), // Minimum plan required (freemium, starter, etc.)
  sortOrder: integer('sort_order').default(0), // Display order within category
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxFeaturesName: index('idx_features_name').on(table.name),
  idxFeaturesCategory: index('idx_features_category').on(table.category),
}));

// Plan-Features junction table - links plans to features with enable/disable status
export const planFeatures = pgTable('plan_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  featureName: text('feature_name').notNull(), // References features.name
  isEnabled: boolean('is_enabled').default(true), // Whether feature is enabled for this plan
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxPlanFeaturesPlan: index('idx_plan_features_plan').on(table.planId),
  idxPlanFeaturesFeature: index('idx_plan_features_feature').on(table.featureName),
  uniquePlanFeature: uniqueIndex('unique_plan_feature').on(table.planId, table.featureName),
}));

// Organizations table - cœur du multi-tenant
// Note: planId and limits are stored in subscriptions and plans tables
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'), // Nullable until configured
  slug: text('slug').unique(), // Nullable until configured
  type: text('type', { enum: ['agency', 'sci', 'syndic', 'individual'] }).default('individual'),
  country: text('country').notNull().default('SN'), // Code pays ISO 3166-1 alpha-2 (SN = Sénégal)
  
  // Compteur réel (mis à jour par trigger ou application)
  extranetTenantsCount: integer('extranet_tenants_count').default(0),

  customExtranetDomain: text('custom_extranet_domain'),
  stripeCustomerId: text('stripe_customer_id'),
  isConfigured: boolean('is_configured').default(false), // True when organization is fully configured
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Subscriptions table - liens entre organisations et abonnements
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }).notNull(),
  
  // Billing
  billingPeriod: text('billing_period', { enum: ['monthly', 'yearly'] }).notNull().default('monthly'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('XOF'), // FCFA
  
  // Status
  status: text('status', { enum: ['active', 'canceled', 'past_due', 'trialing', 'expired'] }).default('active'),
  
  // Dates
  startDate: date('start_date').notNull(),
  endDate: date('end_date'), // null for active subscriptions
  currentPeriodStart: date('current_period_start').notNull(),
  currentPeriodEnd: date('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  
  // Payment
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  paymentMethodId: text('payment_method_id'),
  
  // Trial
  trialStart: date('trial_start'),
  trialEnd: date('trial_end'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxSubOrg: index('idx_sub_org').on(table.organizationId),
  idxSubStatus: index('idx_sub_status').on(table.status),
}));

// User invitations table
export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text('email'), // Nullable if sent by SMS only
  phone: text('phone'), // Nullable if sent by email only
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role', { enum: ['owner', 'admin', 'accountant', 'agent', 'viewer'] }).default('viewer'),
  token: text('token').unique().notNull(), // Unique token for invitation link
  invitationMethod: text('invitation_method', { enum: ['email', 'sms', 'both'] }).default('email'), // Method used to send invitation
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['pending', 'accepted', 'expired', 'cancelled'] }).default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }), // When invitation was actually sent
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxInvitationsOrg: index('idx_invitations_org').on(table.organizationId),
  idxInvitationsToken: index('idx_invitations_token').on(table.token),
  idxInvitationsEmail: index('idx_invitations_email').on(table.email),
  idxInvitationsPhone: index('idx_invitations_phone').on(table.phone),
  idxInvitationsStatus: index('idx_invitations_status').on(table.status),
}));

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  clerkId: text('clerk_id').unique().notNull(),
  email: text('email'),
  phone: text('phone'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role', { enum: ['owner', 'admin', 'accountant', 'agent', 'viewer'] }).default('viewer'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  isSuperAdmin: boolean('is_super_admin').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Super admins table - additional table for super-admin management
export const superAdmins = pgTable('super_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  idxSuperAdminsUser: index('idx_super_admins_user').on(table.userId),
}));

// Properties table
export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city'),
  propertyType: text('property_type'),
  totalUnits: integer('total_units'),
  photoUrls: text('photo_urls').array(),
  notes: text('notes'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }), // Decimal for precise coordinates
  longitude: decimal('longitude', { precision: 11, scale: 8 }), // Decimal for precise coordinates
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Object definitions table - allows super-admins to add new object types dynamically
export const objectDefinitions = pgTable('object_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  objectKey: text('object_key').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  databaseTable: text('database_table'),
  ownershipField: text('ownership_field'),
  sensitiveFields: jsonb('sensitive_fields').default('[]'),
  icon: text('icon'),
  category: text('category'),
  isActive: boolean('is_active').default(true),
  isSystem: boolean('is_system').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  idxObjectDefinitionsKey: index('idx_object_definitions_key').on(table.objectKey),
  idxObjectDefinitionsActive: index('idx_object_definitions_active').on(table.isActive),
  idxObjectDefinitionsCategory: index('idx_object_definitions_category').on(table.category),
}));

// Unit types table - custom types per organization
export const unitTypes = pgTable('unit_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxUnitTypesOrg: index('idx_unit_types_org').on(table.organizationId),
  uniqueOrgSlug: uniqueIndex('unit_types_org_slug_unique').on(table.organizationId, table.slug),
}));

// Units table
export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  unitNumber: text('unit_number').notNull(),
  unitType: text('unit_type'), // Can be standard type or custom type slug
  floor: text('floor'),
  surface: integer('surface'),
  rentAmount: decimal('rent_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  chargesAmount: decimal('charges_amount', { precision: 12, scale: 2 }).default('0'),
  depositAmount: decimal('deposit_amount', { precision: 12, scale: 2 }).default('0'),
  photoUrls: text('photo_urls').array(), // Array of photo URLs for the unit
  status: text('status', { enum: ['vacant', 'occupied', 'maintenance', 'reserved'] }).default('vacant'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxUnitsOrg: index('idx_units_org').on(table.organizationId),
}));

// Tenants table
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  idNumber: text('id_number'),
  hasExtranetAccess: boolean('has_extranet_access').default(false),
  extranetToken: uuid('extranet_token').defaultRandom(),
  language: text('language').default('fr'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxTenantsOrg: index('idx_tenants_org').on(table.organizationId),
}));

// Leases table
export const leases = pgTable('leases', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => units.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  rentAmount: decimal('rent_amount', { precision: 12, scale: 2 }),
  depositPaid: boolean('deposit_paid').default(false),
  signed: boolean('signed').default(false),
  signatureUrl: text('signature_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxLeaseDates: index('idx_lease_dates').on(table.startDate, table.endDate),
}));

// Payment methods table
export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  provider: text('provider').notNull(),
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),
  visibleToTenants: boolean('visible_to_tenants').default(true),
  config: jsonb('config').default({}),
  feeType: text('fee_type', { enum: ['percent', 'fixed', 'none'] }).default('none'),
  feeValue: decimal('fee_value', { precision: 8, scale: 4 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueOrgSlug: uniqueIndex('unique_org_slug').on(table.organizationId, table.slug),
}));

// Payments table
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  unitId: uuid('unit_id').references(() => units.id),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }).default('0'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'refunded'] }).default('pending'),
  transactionId: text('transaction_id'),
  gatewayResponse: jsonb('gateway_response'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxPaymentsOrg: index('idx_payments_org').on(table.organizationId),
}));

// Accounts table (SYSCOHADA)
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountNumber: text('account_number').unique().notNull(),
  label: text('label').notNull(),
  category: text('category').notNull(),
  isActive: boolean('is_active').default(true),
});

// Journal entries table
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  description: text('description'),
  reference: text('reference'),
  validated: boolean('validated').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxJournalOrg: index('idx_journal_org').on(table.organizationId),
}));

// Journal lines table
export const journalLines = pgTable('journal_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => accounts.id),
  debit: decimal('debit', { precision: 12, scale: 2 }).default('0'),
  credit: decimal('credit', { precision: 12, scale: 2 }).default('0'),
  description: text('description'),
});

// Tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  assignedTenantId: uuid('assigned_tenant_id').references(() => tenants.id),
  dueDate: timestamp('due_date', { withTimezone: true }),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).default('medium'),
  status: text('status', { enum: ['todo', 'in_progress', 'waiting', 'done'] }).default('todo'),
  attachments: text('attachments').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  idxTasksOrg: index('idx_tasks_org').on(table.organizationId),
  idxTasksCreatedBy: index('idx_tasks_created_by').on(table.createdBy),
  idxTasksAssignedTo: index('idx_tasks_assigned_to').on(table.assignedTo),
}));

// Task activities table - tracks all activities on tasks
export const taskActivities = pgTable('task_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', etc.
  fieldName: text('field_name'), // Name of the field modified (if applicable)
  oldValue: text('old_value'), // Old value (if applicable)
  newValue: text('new_value'), // New value (if applicable)
  description: text('description'), // Description of the action
  metadata: jsonb('metadata'), // Additional metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxTaskActivitiesTask: index('idx_task_activities_task').on(table.taskId),
  idxTaskActivitiesUser: index('idx_task_activities_user').on(table.userId),
  idxTaskActivitiesCreated: index('idx_task_activities_created').on(table.createdAt),
}));

// Generic activities table - tracks activities on all entities
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(), // 'property', 'unit', 'tenant', 'lease', 'payment', 'journal_entry', 'task', 'user', etc.
  entityId: uuid('entity_id').notNull(), // ID of the entity
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // User who performed the action
  action: text('action').notNull(), // 'created', 'updated', 'deleted', 'status_changed', 'assigned', etc.
  fieldName: text('field_name'), // Name of the field modified (if applicable)
  oldValue: text('old_value'), // Old value (if applicable)
  newValue: text('new_value'), // New value (if applicable)
  description: text('description').notNull(), // Human-readable description of the action
  metadata: jsonb('metadata'), // Additional metadata (full old/new values, etc.)
  ipAddress: text('ip_address'), // User's IP address (optional)
  userAgent: text('user_agent'), // User's browser user agent (optional)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxActivitiesOrg: index('idx_activities_org').on(table.organizationId),
  idxActivitiesEntity: index('idx_activities_entity').on(table.entityType, table.entityId),
  idxActivitiesUser: index('idx_activities_user').on(table.userId),
  idxActivitiesCreated: index('idx_activities_created').on(table.createdAt),
  idxActivitiesAction: index('idx_activities_action').on(table.action),
  idxActivitiesOrgEntity: index('idx_activities_org_entity').on(table.organizationId, table.entityType, table.entityId),
  idxActivitiesOrgCreated: index('idx_activities_org_created').on(table.organizationId, table.createdAt),
}));

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  type: text('type').notNull(),
  channel: text('channel', { enum: ['sms', 'email', 'push', 'whatsapp'] }),
  content: text('content'),
  status: text('status', { enum: ['sent', 'delivered', 'failed'] }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  senderType: text('sender_type', { enum: ['tenant', 'staff'] }),
  senderId: uuid('sender_id'),
  content: text('content'),
  attachments: text('attachments').array(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxMessagesTenant: index('idx_messages_tenant').on(table.tenantId),
}));

// Owners table
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  bankAccount: text('bank_account'),
  bankName: text('bank_name'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('20.00'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxOwnersOrg: index('idx_owners_org').on(table.organizationId),
  idxOwnersProperty: index('idx_owners_property').on(table.propertyId),
}));

// Owner transfers table
export const ownerTransfers = pgTable('owner_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => owners.id, { onDelete: 'set null' }),
  unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  commissionAmount: decimal('commission_amount', { precision: 12, scale: 2 }).default('0'),
  dueDate: date('due_date').notNull(),
  status: text('status', { enum: ['scheduled', 'pending', 'completed', 'cancelled'] }).default('scheduled'),
  transferMethod: text('transfer_method'),
  transferReference: text('transfer_reference'),
  transferredAt: timestamp('transferred_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxOwnerTransfersOrg: index('idx_owner_transfers_org').on(table.organizationId),
  idxOwnerTransfersOwner: index('idx_owner_transfers_owner').on(table.ownerId),
  idxOwnerTransfersStatus: index('idx_owner_transfers_status').on(table.status),
  idxOwnerTransfersDueDate: index('idx_owner_transfers_due_date').on(table.dueDate),
}));