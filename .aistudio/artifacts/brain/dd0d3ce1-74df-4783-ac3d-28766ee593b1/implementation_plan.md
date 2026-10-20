# PeerSwap: Tizim Arxitekturasi va Texnik Hujjati (Architecture Specification Plan)

Ushbu reja **PeerSwap (P2P Ko‘nikma Almashish Platformasi)**ning to‘liq tizim arxitekturasini, tarkibiy modullarini, ma'lumotlar bazasi (Cloud Firestore) modelini, xavfsizlik mexanizmlari va server/infratuzilma tuzilmasini batafsil diagrammalar bilan ishlab chiqish va loyihaga qo‘shishni o‘z ichiga oladi.

---

## 1. Umumiy Tizim Arxitekturasi (High-Level Architecture)

PeerSwap — zamonaviy, reaktiv va serverless arxitekturaga asoslangan P2P (Peer-to-Peer) ta'lim platformasi.

```
+-----------------------------------------------------------------------------------+
|                                FOYDALANUVCHI INTERFEYSI                           |
|                      (React 19 + TanStack Router + Tailwind CSS)                  |
+-----------------------------------------------------------------------------------+
        |                                   |                              |
        v                                   v                              v
+------------------+             +----------------------+       +-------------------+
|  Autentifikatsiya |             | Reaktiv Ma'lumotlar  |       | Real-Time Aloqa   |
| (Firebase Auth)  |             |  (Cloud Firestore)   |       |  & Video Room     |
| - Google Sign-In |             | - profiles           |       | - Chat & Mesajlar |
| - Email / Parol  |             | - swap_sessions      |       | - Local & Remote  |
| - Role (Admin)   |             | - calendar_slots     |       |   WebRTC / Stream |
+------------------+             | - feedback           |       | - Dars yozuvlari  |
                                 | - ai_recommendations |       |   (IndexedDB)     |
                                 +----------------------+       +-------------------+
                                            ^
                                            | (Qat'iy ABAC qoidalari)
                                 +----------------------+
                                 |   firestore.rules    |
                                 | (Zero-Trust Security)|
                                 +----------------------+
```

---

## 2. Asosiy Qismlar va Modullar Tafsiloti

### A. Frontend va Foydalanuvchi Tajribasi (Presentation Layer)

- **Framework:** React 19 (SPA rejimida, TanStack Start & Router bilan boshqariladi).
- **Styling & UI Kit:** Tailwind CSS v4, Radix UI asosidagi komponentlar to‘plami (Modallar, Drawerlar, Tablar, Input-OTP, Popoverlar).
- **State Management & Caching:** `@tanstack/react-query` orqali keshlanadi va server bilan optimallashtirilgan holatda sinxronlashadi.

### B. Autentifikatsiya va Ruxsatlar Tizimi (Identity & Access Management)

- **Firebase Auth:**
  - **Google OAuth:** 1-klikli xavfsiz popup tizimi.
  - **Email/Parol:** Foydalanuvchi uchun to‘siqsiz, to‘g‘ridan-to‘g‘ri ro‘yxatdan o‘tish va hisob yaratilishi bilanoq avtomatik profil ochilishi.
- **RBAC / ABAC (Role-Based Access):**
  - Oddiy foydalanuvchi: o‘z profili, o‘ziga tegishli almashinuvlar va slotlarni boshqaradi.
  - Administrator: boshqaruv panelida barcha mashg‘ulotlar, a'zolar, fikr-mulohazalar va AI tavsiyalar statistikasini nazorat qiladi.

### C. Ma'lumotlar Bazasi va Xavfsizlik (Data Persistence & Security Layer)

- **Google Cloud Firestore (Enterprise DB):**
  - `profiles/{userId}`: Foydalanuvchi ma'lumotlari, PeerPoint balansi, `teach[]` va `learn[]` massivlari.
  - `swap_sessions/{sessionId}`: Ikki tomonlama ko‘nikma almashinuv so‘rovlari, holatlari (`pending`, `accepted`, `completed`).
  - `calendar_slots/{slotId}`: Haftalik jadval slotlari, dars davomiyligi, onlayn/oflayn belgilari.
  - `feedback/{feedbackId}`: O‘tkazilgan darslar bahosi va taqrizlar.
  - `ai_recommendations/{recId}`: AI orqali amalga oshirilgan qidiruv va tavsiyalar arxivi.
  - `admins/{adminId}`: Administrator ruxsatlari.
- **Firestore Security Rules (ABAC Zero-Trust):**
  - Har qanday ruxsatsiz yozuv yoki o‘zganing ma'lumotlarini o‘zgartirish baza darajasida bloklangan.

### D. AI Tavsiya Mexanizmi (AI Matching Engine)

- Foydalanuvchining ehtiyoji (`need`), o‘rgata oladigan (`teach`) va o‘rganmoqchi bo‘lgan (`learn`) ko‘nikmalari o‘rtasidagi semantik va to‘g‘ridan-to‘g‘ri o‘zaro moslikni (reciprocal match) hisoblovchi balli algoritm (60% dan 99% gacha moslik koeffitsienti).

### E. Dars Xonasi va Real-Time Muloqot (Real-time Collaboration Layer)

- **Chat & Logistika:** Jonli suhbat, dars vaqtini o‘zgartirish takliflari, tezkor xabarlar.
- **Video Xona & Yozib olish:** Web MediaStream API orqali darsni video tarzda o‘tish hamda brauzerning IndexedDB xotirasiga video darsni yozib olib yuklab olish imkoniyati.

### F. Build & Cloud Run Production Infratuzilmasi

- **Node.js + Vite Preview:** `dist/server/server.js` shimi orqali Cloud Run konteynerida yuqori barqarorlik va 0 ta SSR nosozligi bilan ishga tushadi.

---

## 3. Loyihaga Kiritiladigan O‘zgarishlar

1. Loyiha ildizida batafsil **`docs/ARCHITECTURE.md`** texnik hujjatini yaratish (barcha diagrammalar, ma'lumotlar modeli, API va oqimlar bilan).
2. Tizim arxitekturasi va komponentlar diagrammasini foydalanuvchiga taqdim etish.
