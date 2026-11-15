<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/inertia.tsx'])
    <x-inertia::head />
</head>
<body class="min-h-screen bg-stone-50 text-stone-900 antialiased">
    <x-inertia::app />
</body>
</html>
