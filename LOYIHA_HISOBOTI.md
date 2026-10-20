# PeerSwap — Loyiha Holati va Funksiyalar Hisoboti

**Hujjat sanasi:** 2026-yil 14-oktabr  
**Loyiha nomi:** PeerSwap (P2P Ko‘nikma Almashish Platformasi)  
**Asosiy shior:** _"O‘rgatib o‘rganing — bilimlarni erkin almashing"_

---

## 1. Loyihaning Maqsadi va Umumiy Konsepsiyasi

PeerSwap — bu odamlar o‘zaro pullik to‘lovlarsiz o‘z bilim va tajribalarini almashadigan Peer-to-Peer (P2P) platforma.
Platformaning asosiy iqtisodiy modeli **PeerPoint (PeerCoin)** balansi orqali ishlaydi:

- Har bir yangi foydalanuvchiga boshlang‘ich **10 PeerPoint** beriladi.
- Boshqa birovga dars o‘tgan (o‘rgatgan) foydalanuvchi **PeerPoint ishlab oladi**.
- Boshqa foydalanuvchidan dars olgan (o‘rgangan) foydalanuvchi **1 PeerPoint sarflaydi**.
- Natijada tizim o‘z-o‘zini rag‘batlantiruvchi barqaror ta’lim ekotizimini hosil qiladi.

---

## 2. Saytda Amalga Oshirilgan Asosiy Qismlar va Funksiyalar

Hozirgi vaqtda loyihada quyidagi barcha asosiy bloklar va modullar to‘liq ishlab chiqilgan va faol ishlamoqda:

### A. Autentifikatsiya va Foydalanuvchi Tizimi (`/login`, `/signup`)

1. **Google orqali bir bosqichli kirish (Google OAuth)**:
   - Foydalanuvchi Google hisobi orqali to‘g‘ridan-to‘g‘ri tizimga kira oladi.
2. **Email va Parol orqali ro‘yxatdan o‘tish va kirish**:
   - To‘liq validatsiya va xavfsiz autentifikatsiya (Firebase Auth).
3. **Avtomatik Profil Yaratilishi (`ensureUserProfile`)**:
   - Foydalanuvchi birinchi marta kirganda avtomatik tarzda uning Firestore bazasida profili ochiladi, 10 ta boshlang‘ich PeerPoint taqdim etiladi.
4. **Avtorizatsiya himoyasi (`useRequireAuth`)**:
   - Tizimga kirmagan foydalanuvchilar avtomatik tarzda `/login` sahifasiga yo‘naltiriladi.
5. **Chiqish (Sign Out)**:
   - Bitta tugma orqali sessiyani tozalab tizimdan chiqish.

---

### B. Bosh Sahifa (Landing Page — `/`)

- **Hero Bo‘limi (`HomeHero`)**: Platformaning asosiy mohiyati, harakatga chaqiruvchi tugmalar (CTA) va vizual taqdimot.
- **3 Qadamli Yo‘riqnoma**:
  1. _Ko‘nikmalarni kiritish_ — profilni to‘ldirish.
  2. _Mos hamkorni topish_ — aqlli qidiruv va kalendar orqali vaqtni tanlash.
  3. _Jonli dars va bilim almashish_ — video aloqa va PeerPoint aylanishi.
- **Muvaffaqiyatli Tajribalar (`TestimonialsSection`)**: Haqiqiy foydalanuvchilar tajribasi va fikrlari.
- **Savol-Javoblar (`FaqSection`)**: Ko‘p beriladigan savollar uchun qulay interaktiv akkordeon.
- **Footer**: Aloqa havolalari, maxfiylik va bo‘limlarga tezkor o‘tish.

---

### C. Foydalanuvchi Boshqaruv Paneli (Dashboard — `/dashboard`)

1. **Shaxsiy Statistika Vidjetlari**:
   - Mavjud PeerPoint balansi;
   - Faol dars sessiyalari;
   - O‘rgatilayotgan va o‘rganilayotgan ko‘nikmalar soni;
   - Hafta davomida o‘tkazilgan darslar.
2. **"Mening Sessiyalarim" (My Sessions)**:
   - Kutilayotgan so‘rovlar (Pending), tasdiqlangan (Confirmed) va tugatilgan darslar.
3. **Aqlli Hamkorlar Tavsiyasi (Smart Matches)**:
   - Tizim avtomatik ravishda boshqa foydalanuvchilarning ko‘nikmalarini solishtirib, eng mos keladiganlarini birinchi qatorda taklif etadi.
4. **Tezkor Harakatlar**:
   - Kalendarga yangi dars vaqti qo‘shish, yangi ko‘nikma kiritish.

---

### D. Hamkorlarni Qidirish va AI Moslashtirish (`/matches`)

1. **Ko‘nikmalar Matritsasi Bo‘yicha Qidiruv**:
   - Masalan: Siz "Ingliz tili" o‘rgatib "Python" o‘rganmoqchisiz; tizim sizga aynan "Python" o‘rgatib "Ingliz tili" o‘rganmoqchi bo‘lgan a’zolarni topadi.
2. **Filtrlash va Saralash**:
   - Toifalar: Dasturlash, Xorijiy tillar, Dizayn, Biznes, Fan va Musiqa.
   - Qidiruv satri orqali ko‘nikma nomi yoki ism bo‘yicha tezkor filter.
3. **Moslik Ko‘rsatkichi (Match Score)**:
   - Foiz ko‘rinishida moslik darajasi (masalan, 95% Moslik).
4. **Taklif Yuborish (Request Swap)**:
   - Hamkor kartasidagi bitta tugma bilan dars so‘rovi yaratiladi.

---

### E. Interaktiv Kalendar va Dars Vaqtlari (`/calendar`)

1. **Vaqt Slotlari Yaratish (Create Slot)**:
   - Foydalanuvchi qaysi kuni, soat nechada va qaysi ko‘nikma bo‘yicha bo‘sh ekanligini e’lon qiladi (`teach` yoki `learn`).
2. **Slotga Yozilish (Join Slot)**:
   - Boshqa foydalanuvchi ochiq slotni tanlab, o‘zini hamkor sifatida biriktiradi.
3. **Holatlarni Boshqarish**:
   - `open` (ochiq), `joined` (hamkor qo‘shilgan), `completed` (yakunlangan) yoki `cancelled` (bekor qilingan).
4. **Shaxsiy va Umumiy Rejim**:
   - "Faqat mening slotlarim" yoki "Barcha ochiq slotlar" ko‘rinishida ko‘rish.

---

### F. Dars Xonalari va Jonli Muloqot (`/sessions`)

1. **Sessiya Kartalari**:
   - Hamkor ismi, mavzu, belgilangan vaqt va hozirgi status.
2. **Real-Vaqtli Dars Chati (`RealtimeSessionChat`)**:
   - Darsdan oldin va dars paytida hamkor bilan to‘g‘ridan-to‘g‘ri yozishish, materiallar almashish.
3. **Video Dars Xonasi (`VideoSessionModal`)**:
   - Kamera va mikrofonni yoqish/o‘chirish;
   - Ekranni namoyish qilish (Screen Sharing);
   - Jonli video orqali interaktiv dars o‘tish imkoniyati.
4. **Ikki Tomonlama Yakunlash Tasdig‘i (Dual Confirmation)**:
   - Dars tugagach, har ikkala ishtirokchi dars bo‘lib o‘tganini tasdiqlaydi, shundan so‘ng PeerPoint balansi yangilanadi.
5. **Baholash va Sharh Qoldirish (`SessionReviewModal`)**:
   - 1 dan 5 gacha yulduzcha berish;
   - Hamkor haqida samimiy fikr va tavsif yozish (bu profil reytingini shakllantiradi).

---

### G. Foydalanuvchi Profili Sozlamalari (`/profile`)

1. **Shaxsiy Ma’lumotlar**:
   - Ism, familiya, o‘zi haqida qisqacha ma’lumot (Bio).
2. **Ko‘nikmalar Boshqaruvi (Skills Management)**:
   - **"Men o‘rgata olaman" (`teach`)**: yangi ko‘nikma qo‘shish (Enter tugmasi yoki tugma orqali) va kerakmasini bitta bosishda o‘chirish.
   - **"Men o‘rganmoqchiman" (`learn`)**: maqsad qilingan ko‘nikmalar ro‘yxatini tuzish.
3. **Tarif va Balans Ma’lumotlari**:
   - Hozirgi PeerPointlar soni va obuna holati.

---

### H. Tarif Rejalari (`/subscription`)

- **Starter (Bepul)**: Haftasiga 3 ta bepul dars, asosiy kalendar va chat.
- **Pro**: Haftasiga cheksiz darslar, ustuvor AI moslashtirish, ilg‘or statistika.
- **Community Hero**: Hamjamiyat rivojiga hissa qo‘shuvchilar uchun maxsus nishon va imkoniyatlar.

---

### I. Administrator Paneli (`/admin`)

- Faqat belgilangan admin (`farhodjonovichm1301@gmail.com`) uchun ochiq.
- Platformadagi foydalanuvchilar soni, faol sessiyalar va darslar statistikasini kuzatish.

---

## 3. Texnik Arxitektura va Foydalanilgan Texnologiyalar

| Yo‘nalish                 | Texnologiya                        | Tavsif                                                        |
| :------------------------ | :--------------------------------- | :------------------------------------------------------------ |
| **Frontend Framework**    | React 19 + TypeScript              | Zamonaviy komponentlar arxitekturasi                          |
| **Routing**               | TanStack Router                    | Type-safe marshrutlash va sahifalararo uzluksiz o‘tish        |
| **Server-Side Rendering** | TanStack Start + Nitro             | Tezkor sahifa yuklanishi (SSR) va SEO qulayligi               |
| **Styling**               | Tailwind CSS v4 + Radix UI         | Dark-mode, moslashuvchan dizayn, qulay UI komponentlar        |
| **Database & Auth**       | Google Firebase (Firestore + Auth) | Foydalanuvchilar, profillar, kalendar va sessiyalarni saqlash |
| **Xavfsizlik**            | `firestore.rules`                  | Hujjatlar darajasidagi qat’iy xavfsizlik va ruxsatnomalar     |
| **Brending**              | Maxsus SVG / ICO Favicon           | PeerSwap ranglari va logotipiga to‘liq moslashtirilgan        |

---

## 4. Ma’lumotlar Bazasi Tuzilmasi (Firestore Collections)

1. `profiles`:
   - `id` (Firebase Auth UID)
   - `first_name`, `last_name`, `bio`
   - `teach` (string massiv: o‘rgatadigan ko‘nikmalar)
   - `learn` (string massiv: o‘rganadigan ko‘nikmalar)
   - `peercoins` (mavjud ballar soni)
   - `plan` ("free" | "pro")
   - `created_at`, `updated_at`
2. `swap_sessions`:
   - `id`, `sender_id`, `receiver_id`, `skill`
   - `status` ("pending" | "confirmed" | "completed" | "cancelled")
   - `scheduled_at`, `completed_at`
3. `calendar_slots`:
   - `id`, `owner_id`, `partner_id`, `kind`, `skill`, `starts_at`, `ends_at`, `status`
4. `session_messages`:
   - Xona bo‘yicha real-vaqtli xabarlar (`session_id`, `sender_id`, `text`, `created_at`).
5. `session_reviews`:
   - Baholar va sharhlar (`session_id`, `author_id`, `target_user_id`, `rating`, `comment`).

---

## 5. Yangi Kiritilgan So‘nggi O‘zgarishlar (Changelog)

1. **Favicon va Brend Ikonlari**:
   - Lovable logotipi butunlay olib tashlandi.
   - P2P bilim almashinuvini ifodalovchi ikkita rang-barang strelkali (ko‘k va zumrad yashil) zamonaviy **`favicon.svg`**, **`favicon.ico`** hamda **`site.webmanifest`** yaratildi.
   - Sahifa teglari (`__root.tsx` va `index.html`) yangi ikonkalarga ulandi.
2. **Oq Ekran (Blank Screen) Muammosi Bartaraf Etildi**:
   - Build paytida SSR moduli to‘g‘ri integratsiya qilinib, `dist/index.html` to‘liq 58 KB lik pre-rendered sahifa bilan ta’minlandi.
   - Deploy qilingan server har qanday so‘rovda to‘liq ishchi holatda HTML javob berishi kafolatlandi.
3. **Firebase Integratsiyasi**:
   - Barcha sahifalar (Dashboard, Profile, Matches, Sessions, Calendar) Firebase Firestore va Firebase Auth tizimiga muvaffaqiyatli o‘tkazildi.

---

_Hujjat PeerSwap platformasining joriy holatini aks ettiradi va kelgusi rivojlantirish bosqichlari uchun to‘liq asos bo‘lib xizmat qiladi._
