<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <link rel="icon" href="data:,">
    <title>Sesi Berakhir - Mutiara Florist</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            background: #F7F3EC;
            color: #1C211E;
            font-family: "Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        .card {
            width: 100%;
            max-width: 420px;
            background: #FFFDF9;
            border: 1px solid #DED6C8;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 1px 2px rgba(28, 33, 30, 0.06);
        }
        .brand {
            font-size: 16px;
            font-weight: 700;
            color: #182920;
            margin: 0 0 18px;
        }
        h1 {
            margin: 0 0 10px;
            font-size: 22px;
            line-height: 1.3;
            color: #1C211E;
        }
        .notice {
            margin: 0 0 22px;
            padding: 14px;
            border-radius: 8px;
            border: 1px solid #E2B3AA;
            background: #FCECE9;
            color: #8A2619;
            font-size: 15px;
            font-weight: 500;
            line-height: 1.5;
        }
        .cta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 44px;
            box-sizing: border-box;
            padding: 10px 18px;
            border-radius: 8px;
            background: #1D3B2A;
            color: #FFFDF9;
            text-decoration: none;
            font-size: 15px;
            font-weight: 600;
        }
        .cta:hover {
            background: #163022;
        }
        .cta:focus-visible {
            outline: 3px solid #1D3B2A;
            outline-offset: 2px;
        }
    </style>
</head>
<body>
    <main class="card">
        <p class="brand">Mutiara Florist</p>
        <h1>Sesi Berakhir</h1>
        <p role="alert" class="notice">{{ $message ?? 'Sesi telah berakhir. Silakan masuk kembali.' }}</p>
        <a href="{{ $recoveryUrl ?? '/login?session_expired=1' }}" class="cta">Kembali ke Halaman Masuk</a>
    </main>
</body>
</html>
