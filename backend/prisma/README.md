## Prisma data model overview

This document explains the Prisma models for the agency nanny app, how they relate, and how to use them with Prisma Client. It reflects the current schema in `prisma/schema.prisma`.

### Models

- **User**
  - Fields: `id`, `email`, `password`, `fullName`, `role`, `accountStatus`, `createdAt`, `updatedAt`
  - Relations:
    - `profile` → optional one-to-one `Profile`
    - `sentMessages`/`receivedMessages` → one-to-many `Message`
    - `postedJobs`/`assignedJobs` → one-to-many `Job`
    - `paymentMethods`, `payouts`
    - `signupPayments` → one-to-many `SignupPayment`

- **Profile**
  - Fields: `id`, `bio`, `location`, `experience`, `userId`
  - Relations: `user` → required one-to-one to `User` (unique `userId`)

- **Job**
  - Fields: `id`, `title`, `description`, `status`, `type`, `startDate?`, `endDate?`, `hoursPerWeek?`, `parentId`, `nannyId?`, `createdAt`, `updatedAt`
  - Relations:
    - `parent` → required many-to-one `User`
    - `nanny` → optional many-to-one `User` (assigned nanny)

- **Message**
  - Fields: `id`, `content`, `senderId`, `receiverId`, `createdAt`
  - Relations:
    - `sender` → required many-to-one `User` (relation `UserMessages`)
    - `receiver` → required many-to-one `User`

- **SignupPayment**
  - Fields: `id`, `userId`, `amount`, `currency`, `status`, `provider`, `providerIntentId?`, `providerChargeId?`, `metadata?`, `createdAt`, `updatedAt`
  - Relations: `user` → required many-to-one `User`

- **Enums**
  - `Role`: `ADMIN | PARENT | NANNY`
  - `JobStatus`: `PENDING | ACCEPTED | COMPLETED | CANCELLED`
  - `JobType`: `SHORT_TERM | LONG_TERM`
  - `AccountStatus`: `PENDING_PAYMENT | ACTIVE | SUSPENDED`

> Note: Messages use separate `sentMessages` and `receivedMessages` for clarity.

### Relationships (high level)

```
User 1 — 0..1 Profile
User 1 — 0..* Job (as parent via parentId)
User 0..1 — 0..* Job (as nanny via nannyId)
User 1 — 0..* Message (as sender)
User 1 — 0..* Message (as receiver)
```

### Common queries (TypeScript)

```ts
// Create a parent user with profile
const parent = await prisma.user.create({
  data: {
    email: "parent@example.com",
    password: "hashed-password",
    fullName: "Pat Parent",
    role: "PARENT",
    profile: { create: { bio: "Loves reliable caregivers", location: "NYC" } },
  },
});

// Create a nanny user
const nanny = await prisma.user.create({
  data: {
    email: "nanny@example.com",
    password: "hashed-password",
    fullName: "Nina Nanny",
    role: "NANNY",
  },
});

// Parent posts a job
const job = await prisma.job.create({
  data: {
    title: "Evening babysitting",
    description: "6–10pm for 2 kids",
    status: "PENDING",
    type: "SHORT_TERM",
    parent: { connect: { id: parent.id } },
  },
  include: { parent: true },
});

// Assign a nanny to the job
await prisma.job.update({
  where: { id: job.id },
  data: { nanny: { connect: { id: nanny.id } }, status: "ACCEPTED" },
});

// Send a message from parent to nanny
await prisma.message.create({
  data: {
    content: "Are you available this Friday?",
    sender: { connect: { id: parent.id } },
    receiver: { connect: { id: nanny.id } },
  },
});

// List a parent's jobs with assigned nanny
const parentJobs = await prisma.job.findMany({
  where: { parentId: parent.id },
  include: { nanny: true },
});

// Inbox for a user (received messages)
const inbox = await prisma.message.findMany({
  where: { receiverId: nanny.id },
  orderBy: { createdAt: "desc" },
});

// Create a long-term job with scheduling context
const longTermJob = await prisma.job.create({
  data: {
    title: "After-school care",
    description: "Mon–Fri, school pickup and homework help",
    type: "LONG_TERM",
    hoursPerWeek: 20,
    startDate: new Date("2025-09-01"),
    parent: { connect: { id: parent.id } },
  },
});

// Query: all short-term jobs
const shortTermJobs = await prisma.job.findMany({ where: { type: "SHORT_TERM" } });

// Create a signup payment intent for a user (e.g., Stripe)
const signupPayment = await prisma.signupPayment.create({
  data: {
    user: { connect: { id: parent.id } },
    amount: new Prisma.Decimal(49.00),
    status: "REQUIRES_CONFIRMATION",
    provider: "STRIPE",
    providerIntentId: "pi_123",
  },
});

// After provider webhook confirms success, activate the account
await prisma.$transaction([
  prisma.signupPayment.update({
    where: { id: signupPayment.id },
    data: { status: "SUCCEEDED", providerChargeId: "ch_123" },
  }),
  prisma.user.update({
    where: { id: parent.id },
    data: { accountStatus: "ACTIVE" },
  }),
]);
```

### Migrations & client

```bash
cd backend
npx prisma format
npx prisma generate
npx prisma migrate dev --name init
```

### Notes & tips

- Use `Job.type` to distinguish long vs short-term roles; store scheduling context in `startDate`, `endDate`, `hoursPerWeek`.
- Gate access using `User.accountStatus`; set to `ACTIVE` only after a successful `SignupPayment`.
- Add indexes on `Job.parentId`, `Job.nannyId` for faster lookups (already present).

### Optional payments extension

If you plan to process payments (escrow per job, refunds, nanny payouts), add models like `Payment`, `Refund`, `Payout`, `PaymentMethod`, and enums (`PaymentStatus`, `RefundStatus`, `PayoutStatus`, `PaymentProvider`, `PayoutProvider`).

Key ideas:
- One `Payment` per `Job`, with `amount`, `platformFee`, `netToNanny`, `status`, and provider IDs (e.g., Stripe PaymentIntent).
- `Refund` rows for partial/full refunds.
- `Payout` rows for nanny disbursements (e.g., Stripe Connect).

After updating or extending the schema:

```bash
cd backend
npx prisma format
npx prisma migrate dev --name job_types_and_signup_payment
```


