import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RealtimeSessionChat } from "@/components/RealtimeSessionChat";

type SessionChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  userId: string;
  userName: string;
  partnerId: string;
  partnerName: string;
  skillName: string;
  scheduledTime?: string;
  onOpenVideoCall: () => void;
  onReschedule?: () => void;
};

export function SessionChatModal({
  isOpen,
  onClose,
  sessionId,
  userId,
  userName,
  partnerId,
  partnerName,
  skillName,
  scheduledTime,
  onOpenVideoCall,
  onReschedule: _onReschedule,
}: SessionChatModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card border-border h-[620px] max-h-[92vh] sm:rounded-xl">
        <RealtimeSessionChat
          sessionId={sessionId}
          userId={userId}
          userName={userName}
          partnerId={partnerId}
          partnerName={partnerName}
          skillName={skillName}
          scheduledTime={scheduledTime}
          onOpenVideoCall={onOpenVideoCall}
          className="border-none rounded-none h-full"
        />
      </DialogContent>
    </Dialog>
  );
}
