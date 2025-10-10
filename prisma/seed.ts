import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Deleting existing data...')
  // Delete in reverse order of dependency
  await prisma.ticket.deleteMany()
  await prisma.lotteryApplication.deleteMany()
  await prisma.lotteryRound.deleteMany()
  await prisma.pointHistory.deleteMany()
  await prisma.authChallenge.deleteMany()
  await prisma.event.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Existing data deleted.')

  console.log('🌱 Seeding data...')

  // 1. Create a sample user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: '0x1234567890123456789012345678901234567890',
      pointBalance: 20000,
    },
  })
  console.log(`👤 Created user: ${user.name} (${user.email})`)

  // 2. Give the user some points
  await prisma.pointHistory.create({
    data: {
      userId: user.id,
      amount: 20000,
      type: 'CHARGE',
      description: 'Initial seed points',
    },
  })
  console.log(`💰 Credited ${user.name} with 20,000 points.`)

  // 3. Create Events
  const now = new Date()
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: 'IU Concert - The Golden Hour',
        description: 'A spectacular concert by IU.',
        ticketCount: 5000,
        price: 15000,
        saleStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'BTS World Tour - Yet To Come',
        description: 'The final concert of the BTS world tour.',
        ticketCount: 10000,
        price: 20000,
        saleStart: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        deadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'Choi Yuri Concert 2025',
        description: 'A concert by Choi Yuri.',
        ticketCount: 3000,
        price: 18000,
        saleStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        deadline: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'Local Indie Band Festival',
        description: 'A festival featuring the best local indie bands.',
        ticketCount: 1000,
        price: 5000,
        saleStart: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        status: 'PUBLISHED', // This one is a draft
      },
    }),
  ])
  console.log(`🎉 Created ${events.length} events.`)

  // 4. Create Lottery Rounds for the first event
  const round1 = await prisma.lotteryRound.create({
    data: {
      eventId: events[0].id,
      roundNumber: 1,
      status: 'OPEN',
      applicationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  })
  console.log(`🎟️ Created lottery round for: ${events[0].title}`)

  // 5. Create a Lottery Application for the user
  const application = await prisma.lotteryApplication.create({
      data: {
          roundId: round1.id,
          userId: user.id,
          walletAddress: user.walletAddress,
          status: 'APPLIED',
      }
  })
  console.log(`📄 Created lottery application for ${user.name} to ${events[0].title}.`)


  console.log('✅ Seed data created successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
