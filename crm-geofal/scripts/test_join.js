
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.geofal.com.pe';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoiYW5vbiJ9.4z7Le-pgOQJXXkW51BxJ7-n-4rRZ64iTZmlWadXN2fE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthenticatedFetch() {
    // 1. Login as dumi
    console.log('Logging in as dumi@crm.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'dumi@crm.com',
        password: 'dumi123'
    });

    if (authError) {
        console.error('Login failed:', authError);
        return;
    }

    console.log('Logged in! User ID:', authData.user.id);

    // 2. Fetch profile with join (same as use-auth.ts)
    console.log('Fetching profile with role_definitions join...');
    const { data, error } = await supabase
        .from("perfiles")
        .select("full_name, role, role_definitions!fk_perfiles_role(label, permissions)")
        .eq("id", authData.user.id)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profile data:', JSON.stringify(data, null, 2));
    }

    // 3. Sign out
    await supabase.auth.signOut();
}

testAuthenticatedFetch();
