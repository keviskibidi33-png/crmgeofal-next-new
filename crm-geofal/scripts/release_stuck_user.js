
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.geofal.com.pe';
const supabaseServiceKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.G5AeMkqPjsBktDw_TpKLMeTsRUpiRYY5l4jZebyU0o4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function releaseUserByEmail(email) {
    console.log(`Searching for user with email: ${email}...`);

    // Supabase doesn't have a direct getUserByEmail in Admin API (crazy right?), 
    // so we list users. For a small DB this is fine.
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`User ${email} NOT FOUND in Auth.users!`);
        return;
    }

    const userId = user.id;
    const timestamp = Date.now();
    const archivedEmail = `deleted_${timestamp}_${email}`;

    console.log(`Found user ${userId}. Archiving to ${archivedEmail}...`);

    // 1. Update Auth
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        email: archivedEmail,
        user_metadata: {
            deleted: true,
            original_email: email,
            released_by_script: true
        }
    });

    if (updateError) {
        console.error('Error updating Auth user:', updateError);
        return;
    }

    console.log('Auth user updated successfully:', data.user.email);
    console.log('You can now recreate this user.');
}

releaseUserByEmail('dumi@crm.com');
