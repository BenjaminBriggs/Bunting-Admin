import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const setupSchema = z.object({
  providers: z.array(z.string()),
  configs: z.record(z.string(), z.record(z.string(), z.string())),
  platformIntegration: z.object({
    enabled: z.boolean(),
    platform: z.string(),
    apiCredentials: z.record(z.string(), z.any())
  })
});

export async function POST(request: NextRequest) {
  console.log('📋 Setup auth-providers endpoint called');

  try {
    const body = await request.json();

    const { providers, configs, platformIntegration } = setupSchema.parse(body);

    // Never log credential values — only non-sensitive shape for diagnostics.
    console.log('✅ Setup configuration parsed successfully:', {
      providers,
      configKeys: Object.keys(configs),
      platformIntegrationEnabled: platformIntegration.enabled,
      platform: platformIntegration.platform
    });

    // For development builds, store the selected providers
    if (process.env.NODE_ENV === 'development') {
      const setupFlagPath = path.join(process.cwd(), '.dev-setup-complete');
      const selectedProvidersPath = path.join(process.cwd(), '.dev-selected-providers.json');

      try {
        // Mark setup as complete
        fs.writeFileSync(setupFlagPath, 'true');

        // Store selected providers and credentials for dev mode
        const selectedProviders = {
          providers,
          configs,
          timestamp: new Date().toISOString()
        };
        fs.writeFileSync(selectedProvidersPath, JSON.stringify(selectedProviders, null, 2));

        console.log('✅ Created dev setup completion flag and stored selected providers:', providers);
      } catch (err) {
        console.error('❌ Failed to create setup files:', err);
      }
    }

    // For development mode, we don't need to persist the setup configuration
    // since it's mainly for UI flow completion. In production, you might want to:
    // 1. Store the selected providers in a configuration file
    // 2. Generate environment variables
    // 3. Update NextAuth configuration dynamically

    const response = {
      success: true,
      message: 'Authentication setup completed successfully',
      selectedProviders: providers
    };

    console.log('✅ Returning response:', response);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ Setup auth providers error:', error);

    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.issues);
      return NextResponse.json(
        { error: 'Invalid setup data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save authentication setup' },
      { status: 500 }
    );
  }
}