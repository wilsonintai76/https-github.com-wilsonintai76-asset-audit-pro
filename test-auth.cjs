const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env.local';
let url = process.env.VITE_SUPABASE_URL;
let key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url && fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envFile.match(/VITE_SUPABASE_URL=([^ \n]+)/);
    const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=([^ \n]+)/);
    if (urlMatch) url = urlMatch[1].trim();
    if (keyMatch) key = keyMatch[1].trim();
}

// Fallback to reading vite config or hardcoding if env not found, but we know it's https://qwhkrbcvbqqclqdpigzw.supabase.co
if (!url) {
    url = 'https://qwhkrbcvbqqclqdpigzw.supabase.co';
    // We cannot read anon key easily without .env, but let's assume it exists in environment.
    console.error("Missing ANON KEY");
}

if (!url || !key) {
    console.log("Provide SUPABASE URL and ANON KEY in environment to test.");
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    console.log("Testing dummy signup to catch DB trigger errors...");
    const { data, error } = await supabase.auth.signUp({
        email: 'test_trigger@poliku.edu.my',
        password: 'TestPassword123!',
        options: {
            data: {
                name: 'Test Setup'
            }
        }
    });

    if (error) {
        console.error("SIGNUP ERROR:", error.message, error.status);
        console.error("Full error:", JSON.stringify(error, null, 2));
    } else {
        console.log("SIGNUP SUCCESS:", data.user?.id);
        // clean up
        console.log("Note: User created successfully. Triggers did not crash.");
    }
}

test();
