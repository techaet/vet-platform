import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    ownerUserId: int("ownerUserId").notNull(),
    status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("organizations_slug_unique").on(table.slug),
    ownerIndex: index("organizations_owner_index").on(table.ownerUserId),
  }),
);

export const organizationMembers = mysqlTable(
  "organizationMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["admin", "veterinarian", "collaborator"])
      .default("veterinarian")
      .notNull(),
    status: mysqlEnum("status", ["active", "invited", "suspended"])
      .default("active")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    organizationUserUnique: uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    userIndex: index("organization_members_user_index").on(table.userId),
    organizationIndex: index("organization_members_organization_index").on(table.organizationId),
  }),
);

export const veterinarianProfiles = mysqlTable(
  "veterinarianProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    displayName: varchar("displayName", { length: 180 }),
    phone: varchar("phone", { length: 40 }),
    professionalRegistration: varchar("professionalRegistration", { length: 80 }),
    bio: text("bio"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    organizationUserUnique: uniqueIndex("veterinarian_profiles_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    userIndex: index("veterinarian_profiles_user_index").on(table.userId),
  }),
);

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  monthlyAmountCents: int("monthlyAmountCents").notNull().default(0),
  includedVeterinarians: int("includedVeterinarians").notNull().default(1),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    planId: int("planId"),
    status: mysqlEnum("status", ["trialing", "active", "past_due", "suspended", "canceled"])
      .default("trialing")
      .notNull(),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    externalCustomerId: varchar("externalCustomerId", { length: 180 }),
    externalSubscriptionId: varchar("externalSubscriptionId", { length: 180 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    organizationIndex: index("subscriptions_organization_index").on(table.organizationId),
    externalSubscriptionIndex: index("subscriptions_external_index").on(
      table.externalSubscriptionId,
    ),
  }),
);

export const subscriptionEvents = mysqlTable(
  "subscriptionEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    subscriptionId: int("subscriptionId").notNull(),
    eventType: varchar("eventType", { length: 100 }).notNull(),
    externalEventId: varchar("externalEventId", { length: 180 }),
    payload: text("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    subscriptionIndex: index("subscription_events_subscription_index").on(table.subscriptionId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type VeterinarianProfile = typeof veterinarianProfiles.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
