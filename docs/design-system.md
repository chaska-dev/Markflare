# Parasti — Design System

Dokumen ini adalah aturan pemakaian. Nilai sebenarnya ada di `tokens.css`.
Jika ada konflik, `tokens.css` yang menang, lalu perbarui dokumen ini.

Setelah fork dibuat, salin file ke:

- `tokens.css` → `src/styles/tokens.css` (dimuat sebelum `index.css`)
- `design-system.md` → `docs/design-system.md`

---

## 1. Prinsip

- **Tenang dan hangat.** Krem kertas dan arang, bukan putih dan abu-abu dingin. Aplikasi ini untuk menulis, jadi permukaannya harus terasa seperti kertas.
- **Satu aksen.** Terakota adalah satu-satunya warna aksen. Jangan menambah warna lain untuk status atau kategori kecuali merah untuk bahaya.
- **Token saja.** Komponen memakai nama token. Tidak boleh ada hex atau `rgba()` mentah di CSS komponen.
- **Kompatibel dengan Markflare.** Nama token lama dipertahankan, jadi merge dari upstream tidak perlu mengganti selector.

---

## 2. Warna

### 2.1 Palet inti

| Peran | Hex | Catatan |
|---|---|---|
| Arang (brand) | `#2B2A26` | Teks utama terang, latar mark |
| Krem (brand) | `#F4EFE6` | Latar sidebar terang, teks utama gelap |
| Terakota (brand) | `#C05A3C` | Aksen non-teks: garis mark, ikon, indikator |
| Terakota gelap | `#A34A2C` | Teks link dan latar tombol utama (terang) |
| Hairline ghost | `#C0A88E` | Dekoratif saja, huruf "a" hantu di logo |

### 2.2 Tema terang

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--bg-primary` | `#FBF8F2` | Area konten |
| `--bg-secondary` | `#F4EFE6` | Sidebar, panel |
| `--bg-tertiary` | `#EAE3D6` | Blok kode, file, callout |
| `--bg-hover` | `#E6DED0` | Hover |
| `--bg-active` | `#DDD4C4` | Item aktif |
| `--text-primary` | `#2B2A26` | Judul, isi |
| `--text-secondary` | `#5C5A52` | Metadata, label |
| `--text-tertiary` | `#77726A` | Placeholder, hint |
| `--accent` | `#C05A3C` | Ikon, indikator drop, focus |
| `--accent-text` | `#A34A2C` | Link, teks aksen |
| `--btn-primary-bg` | `#A34A2C` | Latar tombol utama |
| `--btn-primary-text` | `#F4EFE6` | Teks tombol utama |
| `--danger` | `#B23A32` | Error, aksi hapus |

### 2.3 Tema gelap

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--bg-primary` | `#1E1D1A` | Area konten |
| `--bg-secondary` | `#262521` | Sidebar, panel |
| `--bg-tertiary` | `#2F2E29` | Blok kode, file, callout |
| `--text-primary` | `#F4EFE6` | Judul, isi |
| `--text-secondary` | `#B5AFA3` | Metadata |
| `--text-tertiary` | `#8F897D` | Placeholder |
| `--accent` | `#E08A6C` | Ikon, indikator, focus |
| `--btn-primary-bg` | `#E08A6C` | Latar tombol utama |
| `--btn-primary-text` | `#1E1D1A` | Teks tombol utama |
| `--danger` | `#E8786F` | Error |

Gelap memakai arang hangat (`#1E1D1A`), bukan abu-abu netral. Ini keputusan desain: mode gelap tetap terasa seperti versi malam dari kertas yang sama.

### 2.4 Kontras (WCAG 2.1)

Diukur dengan rumus relatif luminance WCAG. Syarat: teks normal ≥ 4,5:1, teks besar dan elemen UI ≥ 3:1.

| Pasangan | Rasio | Lulus untuk |
|---|---|---|
| Terang: `#2B2A26` di `#FBF8F2` | 13,55 | Teks normal |
| Terang: `#5C5A52` di `#FBF8F2` | 6,52 | Teks normal |
| Terang: `#77726A` di `#FBF8F2` | 4,50 | Teks normal (batas) |
| Terang: `#A34A2C` di `#FBF8F2` | 5,54 | Teks link, normal |
| Terang: `#C05A3C` di `#FBF8F2` | 4,15 | Hanya teks besar dan UI non-teks |
| Terang: `#F4EFE6` di `#A34A2C` | 5,13 | Teks tombol utama |
| Terang: `#B23A32` di `#FBF8F2` | 5,59 | Teks error |
| Gelap: `#F4EFE6` di `#1E1D1A` | 14,72 | Teks normal |
| Gelap: `#B5AFA3` di `#1E1D1A` | 7,73 | Teks normal |
| Gelap: `#8F897D` di `#1E1D1A` | 4,85 | Teks normal |
| Gelap: `#E08A6C` di `#1E1D1A` | 6,44 | Teks link, normal |
| Gelap: `#1E1D1A` di `#E08A6C` | 6,44 | Teks tombol utama |
| Gelap: `#E8786F` di `#1E1D1A` | 5,90 | Teks error |

**Aturan dari angka di atas:**

- Terakota `#C05A3C` (4,15) **tidak boleh** dipakai untuk teks biasa di tema terang. Pakai `--accent-text` (`#A34A2C`).
- `--accent` aman untuk ikon, garis, dan focus ring (≥ 3:1 terhadap latar).
- Jangan pakai `--ghost` untuk teks atau ikon yang harus terbaca. Kontrasnya di bawah 3:1 dan hanya untuk dekorasi.

---

## 3. Tipografi

### 3.1 Keluarga font

| Token | Font | Dipakai untuk |
|---|---|---|
| `--font-display` | Comfortaa | Judul halaman, nama workspace, judul login, logo |
| `--font-sans` | System UI | Isi, label, menu, tombol, input |
| `--font-mono` | System mono | Blok kode, inline code |

Comfortaa dipakai untuk judul saja. Untuk teks panjang, font display terlalu membulat dan melelahkan dibaca. Comfortaa harus di-bundle sebagai `.woff2` di `public/fonts/` dan didaftarkan dengan `@font-face`. Jangan bergantung pada font yang terpasang di sistem.

### 3.2 Skala

| Token | Ukuran | Pemakaian |
|---|---|---|
| `--fs-xs` | 12px | Keterangan, timestamp |
| `--fs-sm` | 13px | Label, sidebar, breadcrumb |
| `--fs-base` | 14px | Isi default |
| `--fs-md` | 16px | Isi di halaman publik |
| `--fs-lg` | 20px | Heading 3 |
| `--fs-xl` | 24px | Heading 2 |
| `--fs-2xl` | 30px | Heading 1 |
| `--fs-3xl` | 40px | Judul halaman |

Bobot: `--fw-regular` (400) untuk isi, `--fw-medium` (500) untuk label, `--fw-semibold` (600) untuk heading kecil, `--fw-bold` (700) untuk judul. Comfortaa dipakai pada bobot 600–700 agar tidak terlalu tipis.

---

## 4. Spasi, radius, dan bayangan

- **Spasi:** kelipatan 4px. Pakai `--space-1` sampai `--space-8` (4, 8, 12, 16, 24, 32, 48, 64). Jangan pakai angka lain seperti 6px atau 10px.
- **Radius:** `--radius-sm` (4px) untuk item kecil dan tombol di toolbar, `--radius-md` (6px) untuk kartu kecil, `--radius-lg` (8px) untuk dropdown dan dialog, `--radius-xl` (16px) untuk kartu login. Radius bulat penuh hanya untuk avatar dan badge.
- **Bayangan:** `--shadow-sm` untuk elemen yang mengambang sedikit, `--shadow-md` untuk popover, `--shadow-lg` untuk dialog. Di gelap, bayangan lebih pekat karena latar sudah gelap.

---

## 5. Komponen kunci

| Komponen | Aturan |
|---|---|
| Tombol utama | Latar `--btn-primary-bg`, teks `--btn-primary-text`, hover `--btn-primary-bg-hover`. Satu per layar. |
| Tombol sekunder | Latar `--bg-tertiary`, teks `--text-secondary`, border `--border-color`. |
| Link | Warna `--link-color`, garis bawah, offset 2px. |
| Focus | Outline atau ring `--focus-ring` dengan lebar 2px. Wajib untuk semua elemen interaktif. |
| Input | Latar `--bg-input`, border `--border-color`, focus border `--accent`. |
| Item sidebar aktif | Latar `--sidebar-active-pill` atau `--bg-active`. |
| Drop indicator | Garis `--accent`, tebal 2px. |
| Seleksi teks | `--selection-bg`. |
| Error | Teks `--danger`, latar `--danger-soft`. |
| Scrim dialog | `--overlay-scrim`. |

Target sentuh minimal 44×44px di layar sentuh (`--touch-target`).

---

## 6. Logo

Aset di folder `parasti-branding/`:

| File | Pakai untuk |
|---|---|
| `logo-mark.svg` | Favicon, sidebar kecil. Mark saja, `currentColor`. |
| `logo-mark-color.svg` | Mark saja, warna tetap. Latar terang: README, OG image. |
| `logo-color.svg` | Mark + logotype, warna tetap. Latar terang. |
| `logo-mono.svg` | Mark + logotype, `currentColor`. Adaptif terang/gelap. Dipakai di header app. |

Aturan:

- Di latar terang, pakai `logo-color.svg`. Di latar gelap, pakai `logo-mono.svg` dengan warna teks `--text-primary`.
- Area kosong di sekitar logo minimal sama dengan tinggi huruf "x" dari logotype.
- Tinggi minimum: 24px untuk mark saja, 32px untuk logo lengkap. Di bawah itu, huruf hantu "a" tidak terbaca.
- Jangan mengubah warna mark, memiringkan, atau memberi bayangan.
- Huruf hantu "a" selalu berupa hairline. Jangan menebalkan garisnya.

---

## 7. Tema dan breakpoint

- Tema default **terang**. Gelap aktif bila `<html data-theme="dark">`.
- Pilihan pengguna disimpan di `localStorage`. Pertama kali buka, ikuti `prefers-color-scheme`.
- Breakpoint, sesuai yang sudah dipakai Markflare (CSS variable tidak bisa dipakai di `@media`):
  - Mobile: `max-width: 767px`
  - Tablet: `max-width: 900px`
  - Desktop: di atas 900px

---

## 8. Aturan untuk kontributor

1. Sebelum menulis warna atau ukuran baru, cek apakah sudah ada token.
2. Jika belum ada, tambahkan token di `tokens.css` lebih dulu, lalu pakai namanya di komponen.
3. Setiap warna teks baru wajib dicek kontrasnya terhadap latar tempat ia dipakai, dan hasilnya dicatat di bagian 2.4.
4. Jangan menambah warna aksen baru. Terakota sudah satu-satunya aksen.
5. Jangan memakai `#000`, `#fff`, atau abu-abu netral. Gunakan token yang hangat.
6. Setiap perubahan token dicatat di `CHANGELOG` atau commit message dengan alasannya.

---

## 9. Migrasi dari Markflare

Yang harus diganti setelah fork:

| Dari Markflare | Menjadi Parasti |
|---|---|
| `--accent: #F38020` | `--accent: #C05A3C` (token dari `tokens.css`) |
| `rgba(243, 128, 32, …)` hardcoded | `var(--accent-soft)` atau `var(--focus-ring)` |
| `rgba(35, 131, 226, …)` hardcoded (subpage, input focus, seleksi) | `var(--accent-soft)` atau `var(--selection-bg)` |
| `var(--color-blue, …)` (seleksi blok) | `var(--selection-bg)` |
| Tombol login `color: #ffffff` | `var(--btn-primary-text)` |
| `.login-ambient-glow` oranye | Glow `--accent-soft` |
| Font system untuk judul | `var(--font-display)` |
| `public/logo.svg`, `public/logo-mark.svg` | Ganti dengan aset Parasti |

Cara cek: setelah migrasi, cari `#` dan `rgba(` di `src/` dan pastikan hanya `tokens.css` yang tersisa.
