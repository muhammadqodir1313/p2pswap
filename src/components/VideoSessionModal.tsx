import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  CircleDot,
  Square,
  Download,
  Play,
  Film,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createSessionChannel,
  fetchSessionRecordings,
  markUserAttended,
  saveSessionRecording,
  type SessionRecording,
} from "@/lib/session-room";

type VideoSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  userId: string;
  userName: string;
  isOwner: boolean;
  partnerId: string;
  partnerName: string;
  skillName: string;
  onSessionEnded: () => void; // Trigger review modal
};

export function VideoSessionModal({
  isOpen,
  onClose,
  sessionId,
  userId,
  userName,
  isOwner,
  partnerId,
  partnerName,
  skillName,
  onSessionEnded,
}: VideoSessionModalProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);

  // Load existing recordings
  useEffect(() => {
    if (isOpen) {
      fetchSessionRecordings(sessionId).then(setRecordings);
      markUserAttended(sessionId, isOwner);
    }
  }, [isOpen, sessionId, isOwner]);

  // Call timer
  useEffect(() => {
    if (!isOpen) {
      setCallSeconds(0);
      return;
    }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) {
      setRecordSeconds(0);
      return;
    }
    const t = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Initialize media & WebRTC / Channel
  useEffect(() => {
    if (!isOpen) return;

    let channelHandle: ReturnType<typeof createSessionChannel> | null = null;
    let localStream: MediaStream | null = null;

    async function setupMedia() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Setup WebRTC peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        peerConnectionRef.current = pc;

        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream!);
        });

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setPartnerConnected(true);
          }
        };

        // Realtime signaling via Supabase Broadcast
        channelHandle = createSessionChannel(sessionId, {
          onAttendance: () => {
            setPartnerConnected(true);
          },
          onSignal: async (signal) => {
            if (signal.senderId === userId) return;
            setPartnerConnected(true);

            if (signal.type === "offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              channelHandle?.sendSignal({
                type: "answer",
                senderId: userId,
                sdp: answer,
              });
            } else if (signal.type === "answer") {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            } else if (signal.type === "candidate" && signal.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              } catch (e) {
                console.warn("ICE candidate error", e);
              }
            }
          },
        });

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channelHandle?.sendSignal({
              type: "candidate",
              senderId: userId,
              candidate: e.candidate,
            });
          }
        };

        // If host/owner, initiate offer
        if (isOwner) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channelHandle?.sendSignal({
            type: "offer",
            senderId: userId,
            sdp: offer,
          });
        }

        channelHandle.broadcastAttendance({ userId, isOwner });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Camera/mic access unavailable, using simulated stream mode:", msg);
        // Fallback: create mock stream using HTML5 canvas
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#38bdf8";
          ctx.font = "24px sans-serif";
          ctx.fillText(userName, 50, 240);
        }
        const stream = canvas.captureStream(15);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
    }

    setupMedia();

    return () => {
      // Clean up media tracks & connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      channelHandle?.unsubscribe();
    };
  }, [isOpen, sessionId, userId, isOwner, userName]);

  // Toggle Camera
  function toggleCamera() {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraActive(videoTrack.enabled);
    }
  }

  // Toggle Mic
  function toggleMic() {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicActive(audioTrack.enabled);
    }
  }

  // Toggle Screen Share
  async function toggleScreenShare() {
    if (isScreenSharing) {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        if (camTrack && localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(camTrack);
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        }
        setIsScreenSharing(false);
      } catch (e) {
        console.warn(e);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack && localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(screenTrack);
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

          screenTrack.onended = () => {
            toggleScreenShare();
          };
          setIsScreenSharing(true);
        }
      } catch (e) {
        console.warn("Screen share cancelled", e);
      }
    }
  }

  // Start Video Recording
  function startRecording() {
    if (!localStreamRef.current) {
      toast.error("Video oqimi mavjud emas.");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const stream = localStreamRef.current;
      const options = { mimeType: "video/webm;codecs=vp8,opus" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recordedChunksRef.current[0]?.type || "video/webm",
        });
        if (blob.size > 0) {
          const title = `${skillName} darsi yozuvi (${new Date().toLocaleTimeString("uz-UZ", {
            hour: "2-digit",
            minute: "2-digit",
          })})`;
          const saved = await saveSessionRecording({
            sessionId,
            title,
            blob,
            durationSeconds: recordSeconds || 1,
          });
          setRecordings((prev) => [saved, ...prev]);
          toast.success("Video yozuv muvaffaqiyatli saqlandi va saytga yuklandi!");
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.info("Darsni video zapis qilish boshlandi!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Zapis boshlanmadi: ${msg}`);
    }
  }

  // Stop Recording
  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // End Call & open review
  function handleEndCall() {
    if (isRecording) {
      stopRecording();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    markUserAttended(sessionId, isOwner);
    onClose();
    onSessionEnded();
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Film className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {skillName} — Jonli dars
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Hamkor: <span className="text-foreground font-medium">{partnerName}</span> · Vaqt:{" "}
                <span className="font-mono text-accent">{formatTime(callSeconds)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400 animate-pulse">
                <CircleDot className="size-3.5 fill-red-500 text-red-500" />
                Zapis: {formatTime(recordSeconds)}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {partnerConnected ? (
                <span className="text-emerald-400 font-medium">Ikkala tomon ulangan</span>
              ) : (
                <span>Hamkor ulanishi kutilmoqda…</span>
              )}
            </div>
          </div>
        </div>

        {/* Video Canvas Stage */}
        <div className="relative bg-black min-h-[360px] sm:min-h-[440px] flex items-center justify-center p-3">
          <div className="grid w-full h-full gap-3 sm:grid-cols-2">
            {/* Local Video */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{userName} (Siz)</span>
                {!micActive && <MicOff className="size-3 text-red-400 ml-1" />}
              </div>
            </div>

            {/* Remote Video / Partner */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!partnerConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <div className="size-16 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-accent">
                    {partnerName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">{partnerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hamkor video xonaga kirishi bilan ulanadi
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                    <Sparkles className="size-3" /> Jonli dars xonasi
                  </span>
                </div>
              )}
              {partnerConnected && (
                <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>{partnerName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant={cameraActive ? "outline" : "destructive"}
              size="sm"
              onClick={toggleCamera}
              className="gap-2"
            >
              {cameraActive ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
              {cameraActive ? "Kamera" : "O‘chiq"}
            </Button>
            <Button
              variant={micActive ? "outline" : "destructive"}
              size="sm"
              onClick={toggleMic}
              className="gap-2"
            >
              {micActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              {micActive ? "Mikrofon" : "O‘chiq"}
            </Button>
            <Button
              variant={isScreenSharing ? "secondary" : "outline"}
              size="sm"
              onClick={toggleScreenShare}
              className="gap-2 hidden sm:inline-flex"
            >
              <Monitor className="size-4" />
              {isScreenSharing ? "Ekranni to‘xtatish" : "Ekran ulashish"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Record Button */}
            {!isRecording ? (
              <Button
                variant="outline"
                size="sm"
                onClick={startRecording}
                className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <CircleDot className="size-4 fill-red-500 text-red-500" />
                Videoni yozib olish (Record)
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                className="gap-2 animate-pulse"
              >
                <Square className="size-4 fill-white" />
                Zapisni to‘xtatish va saqlash
              </Button>
            )}

            {/* End Call Button */}
            <Button variant="destructive" size="sm" onClick={handleEndCall} className="gap-2">
              <PhoneOff className="size-4" />
              Sessiyani yakunlash
            </Button>
          </div>
        </div>

        {/* Saved Recordings list for this session */}
        {recordings.length > 0 && (
          <div className="border-t border-border bg-secondary/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Film className="size-3.5" /> Saqlangan dars yozuvlari ({recordings.length})
            </h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs"
                >
                  <div className="truncate mr-2">
                    <p className="font-medium truncate">{rec.title}</p>
                    <p className="text-muted-foreground">
                      {formatTime(rec.durationSeconds)} · {(rec.sizeBytes / 1024 / 1024).toFixed(1)}{" "}
                      MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setActivePlaybackUrl(rec.videoUrl)}
                      title="Videoni ko‘rish"
                    >
                      <Play className="size-3.5" />
                    </Button>
                    <a
                      href={rec.videoUrl}
                      download={`PeerSwap_${rec.title}.webm`}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      title="Yuklab olish"
                    >
                      <Download className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-app Video Playback Player Modal */}
        {activePlaybackUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-sm font-semibold">Dars yozuvini ko‘rish</h3>
                <Button variant="ghost" size="sm" onClick={() => setActivePlaybackUrl(null)}>
                  ✕ Yopish
                </Button>
              </div>
              <video
                src={activePlaybackUrl}
                controls
                autoPlay
                className="aspect-video w-full rounded-lg bg-black"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
