<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Runtime Isolation Mode
    |--------------------------------------------------------------------------
    |
    | Determines whether this container/process runs as the isolated temporary
    | demo runtime ("demo") or standard production/local runtime ("production").
    | Production runtimes MUST NEVER authenticate the demo account or touch
    | the demo SQLite database. Demo runtimes MUST ONLY use local SQLite.
    |
    */
    'runtime_mode' => env('MFMS_RUNTIME_MODE', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Emergency Demo Kill Switch
    |--------------------------------------------------------------------------
    |
    | Setting DEMO_ENABLED=false or creating the kill-switch flag file
    | immediately revokes demo login and terminates existing demo sessions.
    |
    */
    'enabled' => filter_var(env('DEMO_ENABLED', false), FILTER_VALIDATE_BOOL),

    'kill_switch_file' => env('DEMO_KILL_SWITCH_FILE', storage_path('app/demo/demo.disabled')),

    /*
    |--------------------------------------------------------------------------
    | Dedicated Demo Account Credentials
    |--------------------------------------------------------------------------
    |
    | Credentials are supplied strictly via server environment variables.
    | No hardcoded password fallback is permitted in source code.
    |
    */
    'email' => env('DEMO_EMAIL', 'demo@mutiaraflorist.id'),
    'password' => env('DEMO_PASSWORD'),
    'display_name' => env('DEMO_DISPLAY_NAME', 'Evaluator Demo'),

    /*
    |--------------------------------------------------------------------------
    | 14-Day Server-Side Expiration Window
    |--------------------------------------------------------------------------
    |
    | Activated timestamp (ISO-8601 WIB) plus duration_days (default: 14),
    | or an explicit expires_at timestamp. If neither is configured when
    | demo mode is active, access fails closed (treated as expired).
    |
    */
    'activated_at' => env('DEMO_ACTIVATED_AT'),
    'expires_at' => env('DEMO_EXPIRES_AT'),
    'duration_days' => (int) env('DEMO_DURATION_DAYS', 14),

    /*
    |--------------------------------------------------------------------------
    | Isolated SQLite Storage & Atomic Daily Reset
    |--------------------------------------------------------------------------
    */
    'sqlite_path' => env('DEMO_SQLITE_PATH', storage_path('app/demo/demo.sqlite')),
    'reset_lock_file' => env('DEMO_RESET_LOCK_FILE', storage_path('app/demo/reset.lock')),
    'resetting_flag_file' => env('DEMO_RESETTING_FLAG_FILE', storage_path('app/demo/resetting.flag')),
    'reset_time' => env('DEMO_RESET_TIME', '03:00'),
    'flush_sessions_on_reset' => filter_var(env('DEMO_FLUSH_SESSIONS_ON_RESET', true), FILTER_VALIDATE_BOOL),

    /*
    |--------------------------------------------------------------------------
    | Same-Domain Routing & Cookie Isolation
    |--------------------------------------------------------------------------
    */
    'routing_cookie_name' => env('DEMO_ROUTING_COOKIE', 'mfms_runtime'),
    'routing_cookie_value' => 'demo',
    // 0 = auto-derive sliding TTL (>= session.lifetime + 15m, or 0 if expire_on_close)
    'routing_cookie_lifetime' => (int) env('DEMO_ROUTING_COOKIE_LIFETIME', 0),
    'prod_xsrf_cookie_name' => env('PROD_XSRF_COOKIE', 'MFMS-PROD-XSRF-TOKEN'),
    'demo_xsrf_cookie_name' => env('DEMO_XSRF_COOKIE', 'MFMS-DEMO-XSRF-TOKEN'),
    'prod_xsrf_header_name' => 'X-MFMS-PROD-XSRF-TOKEN',
    'demo_xsrf_header_name' => 'X-MFMS-DEMO-XSRF-TOKEN',
    'runtime_header_name' => 'X-MFMS-Runtime',
    'entry_link_enabled' => filter_var(env('DEMO_ENTRY_LINK_ENABLED', false), FILTER_VALIDATE_BOOL),

    /*
    |--------------------------------------------------------------------------
    | Demo Safety Quotas & Rate Limits
    |--------------------------------------------------------------------------
    */
    'max_customers' => (int) env('DEMO_MAX_CUSTOMERS', 250),
    'max_orders' => (int) env('DEMO_MAX_ORDERS', 250),
    'max_expenses' => (int) env('DEMO_MAX_EXPENSES', 500),
    'max_expense_categories' => (int) env('DEMO_MAX_EXPENSE_CATEGORIES', 50),
];
