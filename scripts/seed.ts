import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a default app
  const app = await prisma.app.upsert({
    where: { identifier: 'my-app' },
    update: {},
    create: {
      name: 'My Application',
      identifier: 'my-app',
      artifactUrl: 'https://cdn.example.com/configs/my-app/',
      publicKeys: [
        {
          kid: 'key-1',
          pem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----'
        }
      ],
      fetchPolicy: {
        min_interval_seconds: 300,
        hard_ttl_days: 7
      }
    }
  });

  console.log('Created app:', app.name);

  // Create some sample cohorts
  const betaCohort = await prisma.cohort.upsert({
    where: {
      appId_key: {
        appId: app.id,
        key: 'beta_users'
      }
    },
    update: {},
    create: {
      appId: app.id,
      key: 'beta_users',
      name: 'Beta Users',
      salt: 'beta_salt_123',
      percentage: 10,
      description: 'Users in the beta testing program'
    }
  });

  const premiumCohort = await prisma.cohort.upsert({
    where: {
      appId_key: {
        appId: app.id,
        key: 'premium_subscribers'
      }
    },
    update: {},
    create: {
      appId: app.id,
      key: 'premium_subscribers', 
      name: 'Premium Subscribers',
      salt: 'premium_salt_456',
      percentage: 25,
      description: 'Users with premium subscriptions'
    }
  });

  console.log('Created cohorts:', betaCohort.name, premiumCohort.name);

  // Create a sample flag
  const sampleFlag = await prisma.flag.upsert({
    where: {
      appId_key: {
        appId: app.id,
        key: 'store/use_new_paywall_design'
      }
    },
    update: {},
    create: {
      appId: app.id,
      key: 'store/use_new_paywall_design',
      displayName: 'Store / Use New Paywall Design',
      type: 'BOOL',
      defaultValue: false,
      description: 'Enable the new paywall UI design',
      rules: [
        {
          id: 'rule_1',
          enabled: true,
          conditions: [
            {
              id: 'condition_1',
              type: 'environment',
              operator: 'in',
              values: ['beta']
            }
          ],
          conditionLogic: 'AND',
          value: true,
          priority: 0
        }
      ]
    }
  });

  console.log('Created flag:', sampleFlag.displayName);

  console.log('Database seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });