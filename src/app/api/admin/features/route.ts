/**
 * Admin Features API Route
 * Allows super-admin to create new features
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { db } from '@/lib/db';
import { isSuperAdmin } from '@/lib/super-admin';

// GET - Fetch all features
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Get user from database
    const dbUser = await db.selectOne<{ id: string; email: string }>('users', {
      eq: { sb_user_id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(dbUser.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Super-admin requis.' },
        { status: 403 }
      );
    }

    // Fetch all features
    const features = await db.select('features', {
      orderBy: { column: 'created_at', ascending: false },
    });

    return NextResponse.json({
      features,
      total: features.length,
    });
  } catch (error: any) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Create a new feature
export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Get user from database
    const dbUser = await db.selectOne<{ id: string; email: string }>('users', {
      eq: { sb_user_id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Check if user is super-admin
    const userIsSuperAdmin = await isSuperAdmin(dbUser.id);

    if (!userIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Super-admin requis.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, displayName, description, category } = body;

    // Validate required fields
    if (!name || !displayName || !category) {
      return NextResponse.json(
        { error: 'Nom, nom d\'affichage et catégorie requis' },
        { status: 400 }
      );
    }

    // Validate name format (should be snake_case)
    const nameRegex = /^[a-z][a-z0-9_]*$/;
    if (!nameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Le nom doit être en snake_case (ex: my_feature_name)' },
        { status: 400 }
      );
    }

    // Check if feature with this name already exists
    const existingFeature = await db.selectOne('features', {
      eq: { name },
    });

    if (existingFeature) {
      return NextResponse.json(
        { error: 'Une fonctionnalité avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    // Create the new feature
    const newFeature = await db.insertOne('features', {
      name,
      display_name: displayName,
      description: description || null,
      category,
      is_active: true,
    });

    if (!newFeature) {
      return NextResponse.json(
        { error: 'Échec de la création de la fonctionnalité' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Fonctionnalité créée avec succès',
      feature: newFeature,
    });
  } catch (error: any) {
    console.error('Error creating feature:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

