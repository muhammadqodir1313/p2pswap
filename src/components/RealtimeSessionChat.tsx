import { useState, useEffect, useRef } from "react";
import {
  Send,
  Video,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Sparkles,
  MessageSquare,
  HelpCircle,
  FileText,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSessionChannel,
  getLocalChatHistory,
  saveLocalChatMessage,
  updateLocalChatMessage,
  type ChatMessage,
  type LogisticsProposal,
} from "@/lib/session-room";

export type RealtimeSessionChatProps = {
  sessionId: string;
  userId: string;
  userName: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  skillName: string;
  scheduledTime?: string;
  onOpenVideoCall?: () => void;
  onLogisticsConfirmed?: (details: { date: string; time: string; platform: string }) => void;
  className?: string;
  showHeader?: boolean;
};

const LOGISTICS_QUICK_CHIPS = [
  "Bugun soat 19:00 ma'qulmi? ⏰",
  "Ertaga dars o‘tsak qulayroqmi? 📅",
  "Video xonaga kirdim, ulaning 📹",
  "Mikrofon va kamera tayyormi? 🎙️",
  "Mavzu rejasini belgilab olamizmi? 📝",
  "Rahmat, darsga tayyorman! 👍",
];

const PLATFORM_LABELS: Record<string, string> = {
  peerswap: "PeerSwap Video (platforma ichida)",
  google_meet: "Google Meet",
  zoom: "Zoom",
  telegram: "Telegram qo‘ng‘iroq",
  offline: "Yuzma-yuz uchrashuv",
};

export function RealtimeSessionChat({
  sessionId,
  userId,
  userName,
  partnerId: _partnerId,
  partnerName,
  partnerAvatar: _partnerAvatar,
  skillName,
  scheduledTime,
  onOpenVideoCall,
  onLogisticsConfirmed,
  className = "",
  showHeader = true,
}: RealtimeSessionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showLogisticsDrawer, setShowLogisticsDrawer] = useState(false);

  // Logistics builder form
  const [proposalDate, setProposalDate] = useState("");
  const [proposalTime, setProposalTime] = useState("19:00");
  const [proposalPlatform, setProposalPlatform] = useState<
    "peerswap" | "google_meet" | "zoom" | "telegram" | "offline"
  >("peerswap");
  const [proposalAgenda, setProposalAgenda] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof createSessionChannel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load chat
  useEffect(() => {
    const history = getLocalChatHistory(sessionId);
    setMessages(history);

    // Initial greeting if empty
    if (history.length === 0) {
      const welcomeMsg: ChatMessage = {
        id: `sys_logistics_${Date.now()}`,
        sessionId,
        senderId: "system",
        senderName: "PeerSwap",
        text: `Salom! "${skillName}" almashinuv darsi uchun logistika chati ochildi. Bu yerda qulay vaqt, platforma va dars rejasini kelishib olishingiz mumkin.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      saveLocalChatMessage(welcomeMsg);
      setMessages([welcomeMsg]);
    }

    // Connect to Supabase Realtime Channel
    const channel = createSessionChannel(sessionId, {
      onMessage: (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      },
      onMessageUpdated: (updatedMsg) => {
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      },
      onTyping: (payload) => {
        if (payload.userId !== userId) {
          setPartnerTyping(payload.isTyping);
        }
      },
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, userId, skillName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // Handle typing broadcast
  const handleInputChange = (val: string) => {
    setInputText(val);

    if (channelRef.current) {
      channelRef.current.sendTyping({
        userId,
        userName,
        isTyping: true,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.sendTyping({
          userId,
          userName,
          isTyping: false,
        });
      }, 1800);
    }
  };

  // Send simple message
  const handleSendMessage = async (textToSend?: string) => {
    const body = (textToSend ?? inputText).trim();
    if (!body) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      senderId: userId,
      senderName: userName,
      text: body,
      createdAt: new Date().toISOString(),
      type: "message",
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current?.sendTyping({ userId, userName, isTyping: false });

    try {
      if (channelRef.current) {
        await channelRef.current.sendMessage(newMsg);
      }
    } catch (err) {
      console.warn("Message sent locally; real-time broadcast fallback", err);
    }
  };

  // Send structured logistics proposal
  const handleSendLogisticsProposal = async () => {
    const dateStr = proposalDate.trim() || new Date().toISOString().split("T")[0];
    const timeStr = proposalTime.trim() || "19:00";
    const platformLabel = PLATFORM_LABELS[proposalPlatform] || proposalPlatform;

    const proposal: LogisticsProposal = {
      proposedDate: dateStr,
      proposedTime: timeStr,
      platform: proposalPlatform,
      agenda: proposalAgenda.trim() || `${skillName} bo‘yicha amaliy mashg‘ulot`,
      status: "pending",
    };

    const proposalMsg: ChatMessage = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      senderId: userId,
      senderName: userName,
      text: `📅 Dars vaqti va joyi taklifi:\n• Sana: ${dateStr}\n• Soat: ${timeStr}\n• Platforma: ${platformLabel}${
        proposalAgenda ? `\n• Reja: ${proposalAgenda}` : ""
      }`,
      createdAt: new Date().toISOString(),
      type: "logistics_proposal",
      logistics: proposal,
    };

    setMessages((prev) => [...prev, proposalMsg]);
    setShowLogisticsDrawer(false);
    setProposalAgenda("");
    toast.success("Dars vaqti taklifi yuborildi!");

    try {
      if (channelRef.current) {
        await channelRef.current.sendMessage(proposalMsg);
      }
    } catch (err) {
      console.warn("Proposal saved locally; real-time broadcast fallback", err);
    }
  };

  // Respond to a proposal (Accept / Decline)
  const handleRespondToProposal = async (msg: ChatMessage, accept: boolean) => {
    if (!msg.logistics) return;

    const newStatus: "accepted" | "declined" = accept ? "accepted" : "declined";
    const updatedMsg: ChatMessage = {
      ...msg,
      logistics: {
        ...msg.logistics,
        status: newStatus,
      },
    };

    // Update in state and local storage
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? updatedMsg : m)));
    updateLocalChatMessage(sessionId, msg.id, updatedMsg);

    // Send broadcast update
    try {
      if (channelRef.current) {
        await channelRef.current.sendUpdatedMessage(updatedMsg);
      }
    } catch (err) {
      console.warn("Could not broadcast update", err);
    }

    // Add confirmation message
    const confirmationText = accept
      ? `✅ ${userName} dars vaqtini tasdiqladi: ${msg.logistics.proposedDate} soat ${msg.logistics.proposedTime} (${PLATFORM_LABELS[msg.logistics.platform || "peerswap"]})`
      : `❌ ${userName} bu vaqtni qulay emas deb topdi. Iltimos, boshqa vaqtni taklif qiling.`;

    const confirmationMsg: ChatMessage = {
      id: `sys_resp_${Date.now()}`,
      sessionId,
      senderId: "system",
      senderName: "PeerSwap",
      text: confirmationText,
      createdAt: new Date().toISOString(),
      type: accept ? "logistics_accepted" : "system",
    };

    setMessages((prev) => [...prev, confirmationMsg]);
    saveLocalChatMessage(confirmationMsg);

    try {
      if (channelRef.current) {
        await channelRef.current.sendMessage(confirmationMsg);
      }
    } catch {
      // Fallback
    }

    if (accept) {
      toast.success("Dars vaqti muvaffaqiyatli kelishildi!");
      onLogisticsConfirmed?.({
        date: msg.logistics.proposedDate || "",
        time: msg.logistics.proposedTime || "",
        platform: msg.logistics.platform || "peerswap",
      });
    } else {
      toast.info("Taklif rad etildi, yangi vaqt taklif qilishingiz mumkin.");
    }
  };

  const formatMsgTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Preset date helpers for proposal form
  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setProposalDate(d.toISOString().split("T")[0]);
  };

  return (
    <div
      className={`flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm ${className}`}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {partnerName.slice(0, 2).toUpperCase()}
              </div>
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-card"
                title="Onlayn aloqa"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {partnerName}
                </h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Real-vaqt chat
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Sparkles className="size-3 text-accent shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[320px]">
                  Mavzu: <span className="font-medium text-foreground">{skillName}</span>
                </span>
                {scheduledTime && <span>· {scheduledTime}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogisticsDrawer(!showLogisticsDrawer)}
              className="gap-1.5 text-xs h-8"
              title="Dars vaqti va joyini kelishish"
            >
              <Calendar className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Vaqt taklif qilish</span>
              {showLogisticsDrawer ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </Button>
            {onOpenVideoCall && (
              <Button
                size="sm"
                onClick={onOpenVideoCall}
                className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Video className="size-3.5" />
                <span className="hidden sm:inline">Video dars</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Logistics Proposal Drawer / Panel */}
      {showLogisticsDrawer && (
        <div className="bg-secondary/40 border-b border-border p-3.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Calendar className="size-3.5 text-primary" />
              Dars logistikasini kelishish (Vaqt va Platforma)
            </div>
            <button
              type="button"
              onClick={() => setShowLogisticsDrawer(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Yopish ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
            {/* Date */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Kuni
              </label>
              <div className="flex gap-1 mb-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="px-2 py-0.5 rounded text-[10px] bg-secondary hover:bg-secondary/80 border border-border"
                >
                  Bugun
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="px-2 py-0.5 rounded text-[10px] bg-secondary hover:bg-secondary/80 border border-border"
                >
                  Ertaga
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="px-2 py-0.5 rounded text-[10px] bg-secondary hover:bg-secondary/80 border border-border"
                >
                  Indinga
                </button>
              </div>
              <Input
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>

            {/* Time */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Boshlanish vaqti
              </label>
              <div className="flex gap-1 mb-1">
                {["10:00", "15:00", "19:00", "20:30"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setProposalTime(t)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-secondary hover:bg-secondary/80 border border-border"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                type="time"
                value={proposalTime}
                onChange={(e) => setProposalTime(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                O‘tkazish joyi
              </label>
              <select
                value={proposalPlatform}
                onChange={(e) =>
                  setProposalPlatform(
                    e.target.value as "peerswap" | "google_meet" | "zoom" | "telegram" | "offline",
                  )
                }
                className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="peerswap">PeerSwap Video (tavsiya etiladi)</option>
                <option value="google_meet">Google Meet</option>
                <option value="telegram">Telegram qo‘ng‘iroq</option>
                <option value="zoom">Zoom</option>
                <option value="offline">Yuzma-yuz uchrashuv</option>
              </select>
            </div>
          </div>

          {/* Agenda */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Dars mavzusi yoki qisqa reja (ixtiyoriy, masalan: 1-amaliyot)"
              value={proposalAgenda}
              onChange={(e) => setProposalAgenda(e.target.value)}
              className="h-8 text-xs flex-1 bg-card"
            />
            <Button
              size="sm"
              onClick={handleSendLogisticsProposal}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <Calendar className="size-3.5" />
              Taklifni yuborish
            </Button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.map((m) => {
          const isMe = m.senderId === userId;
          const isSys = m.senderId === "system" || m.type === "system";
          const isProposal = m.type === "logistics_proposal" && m.logistics;
          const isAcceptedNotice = m.type === "logistics_accepted";

          if (isSys || isAcceptedNotice) {
            return (
              <div key={m.id} className="mx-auto max-w-lg text-center py-1">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border ${
                    isAcceptedNotice
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  {isAcceptedNotice ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <HelpCircle className="size-3.5 shrink-0" />
                  )}
                  <span>{m.text}</span>
                </div>
              </div>
            );
          }

          // Structured Logistics Proposal Card
          if (isProposal && m.logistics) {
            const prop = m.logistics;
            const isPending = prop.status === "pending";
            const isAccepted = prop.status === "accepted";
            const isDeclined = prop.status === "declined";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 px-1">
                  <span>{isMe ? "Siz taklif qildingiz" : `${m.senderName} taklif qildi`}</span>
                  <span>·</span>
                  <span>{formatMsgTime(m.createdAt)}</span>
                </div>

                <div
                  className={`w-full max-w-md rounded-xl p-3.5 border transition-all ${
                    isAccepted
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/40"
                      : isDeclined
                        ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-500/30 opacity-80"
                        : "bg-card border-border shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <Calendar className="size-3.5 text-primary" />
                      Dars vaqti taklifi
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isAccepted
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : isDeclined
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse"
                      }`}
                    >
                      {isAccepted
                        ? "✅ Tasdiqlangan"
                        : isDeclined
                          ? "❌ Rad etilgan"
                          : "⏳ Javob kutilmoqda"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <span>
                        {prop.proposedDate} soat {prop.proposedTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      <span>{PLATFORM_LABELS[prop.platform || "peerswap"]}</span>
                    </div>

                    {prop.agenda && (
                      <div className="flex items-start gap-2 text-muted-foreground pt-1 border-t border-border/50 text-[11px]">
                        <FileText className="size-3.5 shrink-0 mt-0.5" />
                        <span>Reja: {prop.agenda}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for recipient if pending */}
                  {!isMe && isPending && (
                    <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespondToProposal(m, false)}
                        className="text-xs h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <XCircle className="size-3.5 mr-1" />
                        Rad etish
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleRespondToProposal(m, true)}
                        className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        <CheckCircle2 className="size-3.5 mr-1" />
                        Qabul qilish
                      </Button>
                    </div>
                  )}

                  {/* Direct button to launch video call if accepted */}
                  {isAccepted && onOpenVideoCall && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Vaqt belgilandi!
                      </span>
                      <Button
                        size="sm"
                        onClick={onOpenVideoCall}
                        className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        <Video className="size-3" />
                        Xonaga kirish
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Regular message bubble
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 px-1">
                <span>{isMe ? "Siz" : m.senderName}</span>
                <span>·</span>
                <span>{formatMsgTime(m.createdAt)}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-card text-foreground rounded-tl-none border border-border shadow-xs"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}

        {/* Real-time typing indicator */}
        {partnerTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 animate-pulse">
            <div className="flex gap-1">
              <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce" />
            </div>
            <span>{partnerName} yozmoqda…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Logistics Chips */}
      <div className="border-t border-border/70 bg-card px-3 py-2 overflow-x-auto flex gap-1.5 shrink-0 scrollbar-none">
        {LOGISTICS_QUICK_CHIPS.map((chip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(chip)}
            className="whitespace-nowrap rounded-full border border-border bg-secondary/60 hover:bg-secondary px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card p-3 flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowLogisticsDrawer(!showLogisticsDrawer)}
          title="Dars vaqtini taklif qilish"
          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-primary"
        >
          <Calendar className="size-4" />
        </Button>

        <Input
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Xabar yozing (masalan, qulay vaqtingizni ayting)…"
          className="flex-1 h-9 text-sm"
        />

        <Button
          onClick={() => handleSendMessage()}
          size="icon"
          disabled={!inputText.trim()}
          className="shrink-0 h-9 w-9"
          title="Yuborish"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
