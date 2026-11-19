<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" href="data:,">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/inertia.tsx'])
    <x-inertia::head />
</head>
<body class="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased">
    <x-inertia::app />
</body>
</html>
