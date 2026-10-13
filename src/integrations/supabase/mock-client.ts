// Autonomous in-browser mock implementation of Supabase client.
// Provides Auth, Database CRUD, RPC, and Realtime Broadcast via BroadcastChannel
// so the app runs 100% standalone without requiring an external Supabase account.

type User = {
  id: string;
  email: string;
  user_metadata: {
    first_name?: string;
    last_name?: string;
  };
  created_at: string;
};

type Session = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: User;
};

type TableRow = Record<string, unknown>;

const STORAGE_PREFIX = "peerswap_standalone_";

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn("Storage write error", err);
  }
}

// Seed demo users and profiles
const SEED_PROFILES: TableRow[] = [
  {
    id: "user-ali-1",
    first_name: "Ali",
    last_name: "Valiyev",
    bio: "Senior Frontend dasturchi. React va TypeScript bo‘yicha tajribam bor.",
    peercoins: 30,
    is_active: true,
    is_demo: true,
    created_at: "2026-01-15T10:00:00Z",
    teach: ["React", "TypeScript", "Tailwind CSS"],
    learn: ["Python", "FastAPI", "Docker"],
  },
  {
    id: "user-sardor-2",
    first_name: "Sardor",
    last_name: "Karimov",
    bio: "Backend muhandis. PostgreSQL va Node.js o‘rgatishga tayyorman.",
    peercoins: 20,
    is_active: true,
    is_demo: true,
    created_at: "2026-02-10T10:00:00Z",
    teach: ["SQL JOIN", "Node.js", "PostgreSQL"],
    learn: ["HTML / Flexbox", "UI Dizayn"],
  },
  {
    id: "user-malika-3",
    first_name: "Malika",
    last_name: "Toshmatova",
    bio: "Data Analyst. SQL va Python bilan ma’lumotlarni tahlil qilishni o‘rgataman.",
    peercoins: 15,
    is_active: true,
    is_demo: true,
    created_at: "2026-02-20T10:00:00Z",
    teach: ["Python", "Pandas", "SQL"],
    learn: ["Next.js", "Web dasturlash"],
  },
];

export function createMockSupabaseClient() {
  // Initialize storage seeds
  if (typeof window !== "undefined") {
    if (!localStorage.getItem(STORAGE_PREFIX + "profiles")) {
      setStorage("profiles", SEED_PROFILES);
    }
    if (!localStorage.getItem(STORAGE_PREFIX + "calendar_slots")) {
      const now = new Date();
      const in2Hours = new Date(now.getTime() + 2 * 3600000);
      const in3Hours = new Date(now.getTime() + 3 * 3600000);
      setStorage("calendar_slots", [
        {
          id: "slot-demo-1",
          owner_id: "user-sardor-2",
          partner_id: null,
          kind: "teach",
          skill: "SQL JOIN",
          description: "Murakkab JOIN turlari va optimallashtirish",
          is_online: true,
          starts_at: in2Hours.toISOString(),
          ends_at: new Date(in2Hours.getTime() + 1800000).toISOString(),
          status: "open",
          peerpoint_cost: 1,
          created_at: now.toISOString(),
          owner_done: false,
          partner_done: false,
        },
        {
          id: "slot-demo-2",
          owner_id: "user-ali-1",
          partner_id: null,
          kind: "teach",
          skill: "React Hooks",
          description: "useCallback, useMemo va Custom hooks",
          is_online: true,
          starts_at: in3Hours.toISOString(),
          ends_at: new Date(in3Hours.getTime() + 1800000).toISOString(),
          status: "open",
          peerpoint_cost: 1,
          created_at: now.toISOString(),
          owner_done: false,
          partner_done: false,
        },
      ]);
    }
  }

  const authSubscribers = new Set<(event: string, session: Session | null) => void>();

  function notifyAuth(event: string, session: Session | null) {
    authSubscribers.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const auth = {
    async getSession() {
      const session = getStorage<Session | null>("session", null);
      return { data: { session }, error: null };
    },
    async getUser() {
      const session = getStorage<Session | null>("session", null);
      return { data: { user: session?.user ?? null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      authSubscribers.add(callback);
      // Immediately notify current state
      const session = getStorage<Session | null>("session", null);
      callback("INITIAL_SESSION", session);
      return {
        data: {
          subscription: {
            unsubscribe: () => authSubscribers.delete(callback),
          },
        },
      };
    },
    async signUp(params: {
      email: string;
      password?: string;
      options?: { data?: { first_name?: string; last_name?: string } };
    }) {
      const users = getStorage<Array<User & { password?: string }>>("users", []);
      const existing = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());
      if (existing) {
        return {
          data: { user: null, session: null },
          error: { message: "Bu elektron pochta allaqachon ro‘yxatdan o‘tgan." },
        };
      }

      const userId = `usr_${Date.now()}`;
      const newUser: User & { password?: string } = {
        id: userId,
        email: params.email,
        password: params.password,
        user_metadata: {
          first_name: params.options?.data?.first_name || "Foydalanuvchi",
          last_name: params.options?.data?.last_name || "",
        },
        created_at: new Date().toISOString(),
      };

      users.push(newUser);
      setStorage("users", users);

      // Save demo profile
      const profiles = getStorage<TableRow[]>("profiles", SEED_PROFILES);
      profiles.push({
        id: userId,
        first_name: newUser.user_metadata.first_name,
        last_name: newUser.user_metadata.last_name,
        bio: "Yangi PeerSwap a’zosi",
        peercoins: 10,
        is_active: true,
        is_demo: false,
        created_at: newUser.created_at,
        teach: ["Boshlang‘ich dasturlash"],
        learn: ["React", "Ingliz tili"],
      });
      setStorage("profiles", profiles);

      // Set pending verification code
      setStorage("pending_otp_" + params.email.toLowerCase(), "123456");
      console.info(`[PeerSwap Standalone] Tasdiqlash kodi: 123456 (Email: ${params.email})`);

      return {
        data: {
          user: newUser,
          session: null,
        },
        error: null,
      };
    },
    async verifyOtp(params: { email: string; token: string; type?: string }) {
      const pendingCode = getStorage<string | null>(
        "pending_otp_" + params.email.toLowerCase(),
        "123456",
      );
      if (params.token !== pendingCode && params.token !== "123456") {
        return {
          data: { user: null, session: null },
          error: { message: "Kod noto‘g‘ri. Test kodi: 123456" },
        };
      }

      const users = getStorage<Array<User & { password?: string }>>("users", []);
      let user = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());

      if (!user) {
        // Auto-create user if needed
        user = {
          id: `usr_${Date.now()}`,
          email: params.email,
          user_metadata: { first_name: "Foydalanuvchi", last_name: "" },
          created_at: new Date().toISOString(),
        };
        users.push(user);
        setStorage("users", users);
      }

      const session: Session = {
        access_token: `mock_token_${Date.now()}`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: `mock_ref_${Date.now()}`,
        user,
      };

      setStorage("session", session);
      notifyAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    async signInWithPassword(params: { email: string; password?: string }) {
      const users = getStorage<Array<User & { password?: string }>>("users", []);
      let user = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());

      if (!user) {
        // Auto create for ease of testing
        user = {
          id: `usr_${Date.now()}`,
          email: params.email,
          user_metadata: { first_name: "Foydalanuvchi", last_name: "" },
          created_at: new Date().toISOString(),
        };
        users.push(user);
        setStorage("users", users);
      }

      const session: Session = {
        access_token: `mock_token_${Date.now()}`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: `mock_ref_${Date.now()}`,
        user,
      };

      setStorage("session", session);
      notifyAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    async resend(params: { type: string; email: string }) {
      setStorage("pending_otp_" + params.email.toLowerCase(), "123456");
      console.info(`[PeerSwap Standalone] Qayta yuborilgan kod: 123456 (Email: ${params.email})`);
      return { data: {}, error: null };
    },
    async signOut() {
      setStorage("session", null);
      notifyAuth("SIGNED_OUT", null);
      return { error: null };
    },
  };

  function from(tableName: string) {
    const tableKey = tableName === "peer_directory" ? "profiles" : tableName;
    const data = getStorage<TableRow[]>(tableKey, []);

    const filters: Array<(row: TableRow) => boolean> = [];
    let sortFn: ((a: TableRow, b: TableRow) => number) | null = null;
    let limitCount: number | null = null;

    type QueryBuilder = {
      select: (_cols?: string) => QueryBuilder;
      eq: (field: string, val: unknown) => QueryBuilder;
      neq: (field: string, val: unknown) => QueryBuilder;
      gte: (field: string, val: unknown) => QueryBuilder;
      lt: (field: string, val: unknown) => QueryBuilder;
      or: (conditionStr: string) => QueryBuilder;
      order: (field: string, opts?: { ascending?: boolean }) => QueryBuilder;
      limit: (count: number) => QueryBuilder;
      then: (resolve: (res: { data: TableRow[]; error: null }) => void) => void;
      maybeSingle: () => Promise<{ data: TableRow | null; error: null }>;
      insert: (rows: TableRow | TableRow[]) => Promise<{ data: TableRow[]; error: null }>;
      update: (patch: TableRow) => {
        eq: (field: string, val: unknown) => Promise<{ data: TableRow[]; error: null }>;
      };
      delete: () => {
        eq: (field: string, val: unknown) => Promise<{ data: TableRow[]; error: null }>;
      };
    };

    const builder: QueryBuilder = {
      select: (_cols?: string) => builder,
      eq: (field: string, val: unknown) => {
        filters.push((row) => row[field] === val);
        return builder;
      },
      neq: (field: string, val: unknown) => {
        filters.push((row) => row[field] !== val);
        return builder;
      },
      gte: (field: string, val: unknown) => {
        filters.push(
          (row) => new Date(String(row[field])).getTime() >= new Date(String(val)).getTime(),
        );
        return builder;
      },
      lt: (field: string, val: unknown) => {
        filters.push(
          (row) => new Date(String(row[field])).getTime() < new Date(String(val)).getTime(),
        );
        return builder;
      },
      or: (conditionStr: string) => {
        const parts = conditionStr.split(",").map((p) => p.trim());
        filters.push((row) => {
          return parts.some((p) => {
            const [f, op, val] = p.split(".");
            if (op === "eq") return String(row[f || ""]) === val;
            return false;
          });
        });
        return builder;
      },
      order: (field: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending ?? true;
        sortFn = (a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (String(valA) < String(valB)) return asc ? -1 : 1;
          if (String(valA) > String(valB)) return asc ? 1 : -1;
          return 0;
        };
        return builder;
      },
      limit: (count: number) => {
        limitCount = count;
        return builder;
      },
      then: (resolve: (res: { data: TableRow[]; error: null }) => void) => {
        let result = data.filter((row) => filters.every((f) => f(row)));
        if (sortFn) result = result.sort(sortFn);
        if (limitCount != null) result = result.slice(0, limitCount);
        resolve({ data: result, error: null });
      },
      maybeSingle: async () => {
        const result = data.filter((row) => filters.every((f) => f(row)));
        return { data: result[0] ?? null, error: null };
      },
      insert: async (rows: TableRow | TableRow[]) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const current = getStorage<TableRow[]>(tableKey, []);
        const added = arr.map((r) => ({
          id: r["id"] || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          created_at: r["created_at"] || new Date().toISOString(),
          ...r,
        }));
        current.push(...added);
        setStorage(tableKey, current);
        return { data: added, error: null };
      },
      update: (patch: TableRow) => {
        return {
          eq: async (field: string, val: unknown) => {
            const current = getStorage<TableRow[]>(tableKey, []);
            const updated = current.map((row) => {
              if (row[field] === val) {
                return { ...row, ...patch };
              }
              return row;
            });
            setStorage(tableKey, updated);
            return { data: updated, error: null };
          },
        };
      },
      delete: () => {
        return {
          eq: async (field: string, val: unknown) => {
            const current = getStorage<TableRow[]>(tableKey, []);
            const remaining = current.filter((row) => row[field] !== val);
            setStorage(tableKey, remaining);
            return { data: remaining, error: null };
          },
        };
      },
    };

    return builder;
  }

  async function rpc(fnName: string, args?: Record<string, unknown>) {
    const session = getStorage<Session | null>("session", null);
    const uid = session?.user?.id;

    if (fnName === "refresh_weekly_points") {
      return {
        data: [
          {
            week_start: new Date().toISOString().slice(0, 10),
            used: 0,
            plan: "free",
            allowance: 3,
          },
        ],
        error: null,
      };
    }

    if (fnName === "spend_peerpoint") {
      return { data: 1, error: null };
    }

    if (fnName === "join_calendar_slot") {
      const slotId = args?.["_slot_id"];
      const slots = getStorage<TableRow[]>("calendar_slots", []);
      const idx = slots.findIndex((s) => s["id"] === slotId);
      if (idx >= 0) {
        const item = slots[idx];
        if (item) {
          item["partner_id"] = uid;
          item["status"] = "confirmed";
          setStorage("calendar_slots", slots);
          return { data: item, error: null };
        }
      }
      return { data: null, error: { message: "Slot topilmadi" } };
    }

    if (fnName === "set_calendar_slot_status") {
      const slotId = args?.["_slot_id"];
      const status = args?.["_status"];
      const slots = getStorage<TableRow[]>("calendar_slots", []);
      const idx = slots.findIndex((s) => s["id"] === slotId);
      if (idx >= 0) {
        const item = slots[idx];
        if (item) {
          item["status"] = status;
          setStorage("calendar_slots", slots);
          return { data: item, error: null };
        }
      }
      return { data: null, error: { message: "Slot topilmadi" } };
    }

    if (fnName === "complete_session") {
      const sessId = args?.["_session_id"];
      const sessions = getStorage<TableRow[]>("swap_sessions", []);
      const idx = sessions.findIndex((s) => s["id"] === sessId);
      if (idx >= 0) {
        const s = sessions[idx];
        if (s) {
          s["status"] = "completed";
          s["completed_at"] = new Date().toISOString();
          setStorage("swap_sessions", sessions);
        }
      }
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  function channel(name: string) {
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      bc = new BroadcastChannel("supabase_channel_" + name);
    }

    const listeners: Array<{ event: string; callback: (payload: unknown) => void }> = [];

    if (bc) {
      bc.onmessage = (e: MessageEvent<{ event?: string; payload?: unknown }>) => {
        const { event, payload } = e.data || {};
        listeners.filter((l) => l.event === event).forEach((l) => l.callback({ payload }));
      };
    }

    const ch = {
      on: (_type: string, filter: { event: string }, callback: (payload: unknown) => void) => {
        listeners.push({ event: filter.event, callback });
        return ch;
      },
      subscribe: () => ch,
      send: async (msg: { type: string; event: string; payload: unknown }) => {
        if (bc) {
          bc.postMessage({ event: msg.event, payload: msg.payload });
        }
        return "ok";
      },
    };

    return ch;
  }

  function removeChannel(_ch: unknown) {}

  return {
    auth,
    from,
    rpc,
    channel,
    removeChannel,
  };
}
