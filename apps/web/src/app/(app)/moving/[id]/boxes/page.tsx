"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Package, Plus, QrCode, X, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { LoadingSpinner } from "@/components/shared/loading-state";

interface Box {
  id: string;
  boxNumber: number;
  label: string;
  room: string;
  contents?: string;
  isFragile: boolean;
  isPacked: boolean;
  priority?: string;
  qrCode?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeQRData(data: string): string {
  return data.replace(/[^a-zA-Z0-9\-_]/g, "");
}

function generateQRSvg(data: string, size: number = 200): string {
  // Simple QR-like visual using box label data encoded as a pattern grid
  const hash = Array.from(data).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const grid = 21;
  const cellSize = size / grid;
  let cells = "";

  // Fixed finder patterns (top-left, top-right, bottom-left)
  const addFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isBorder = y === 0 || y === 6 || x === 0 || x === 6;
        const isInner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        if (isBorder || isInner) {
          cells += `<rect x="${(ox + x) * cellSize}" y="${(oy + y) * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(grid - 7, 0);
  addFinder(0, grid - 7);

  // Data cells - deterministic from hash
  let seed = Math.abs(hash);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const inFinder = (x < 8 && y < 8) || (x >= grid - 8 && y < 8) || (x < 8 && y >= grid - 8);
      if (inFinder) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        cells += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="white"/>${cells}</svg>`;
}

export default function BoxesPage() {
  const params = useParams();
  const planId = params.id as string;
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newBox, setNewBox] = useState({ label: "", room: "", contents: "", isFragile: false });
  const [saving, setSaving] = useState(false);
  const [qrBox, setQrBox] = useState<Box | null>(null);

  useEffect(() => {
    fetch(`/api/moving/${planId}`)
      .then((res) => res.json())
      .then((data) => setBoxes(data.plan?.boxes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planId]);

  const togglePacked = async (id: string) => {
    const box = boxes.find((b: Box) => b.id === id);
    if (!box) return;
    const newPacked = !box.isPacked;
    setBoxes((prev: Box[]) => prev.map((b: Box) => (b.id === id ? { ...b, isPacked: newPacked } : b)));
    await fetch(`/api/boxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPacked: newPacked }),
    }).catch(() => {
      setBoxes((prev: Box[]) => prev.map((b: Box) => (b.id === id ? { ...b, isPacked: !newPacked } : b)));
    });
  };

  const handleAddBox = async () => {
    if (!newBox.label) return;
    setSaving(true);
    try {
      const res = await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movingPlanId: planId,
          boxNumber: boxes.length + 1,
          label: newBox.label,
          room: newBox.room,
          contents: newBox.contents,
          isFragile: newBox.isFragile,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoxes((prev) => [...prev, data.box]);
        setNewBox({ label: "", room: "", contents: "", isFragile: false });
        setShowForm(false);
      }
    } catch {}
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const packedCount = boxes.filter((b: Box) => b.isPacked).length;
  const progressPct = boxes.length > 0 ? (packedCount / boxes.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/moving/${planId}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Box Tracking</h1>
            <p className="text-muted-foreground text-sm">{packedCount}/{boxes.length} packed</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancel" : "Add Box"}
        </Button>
      </div>

      {/* Progress */}
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Add Box Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Add New Box</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input placeholder="e.g. Kitchen Essentials" value={newBox.label} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBox({ ...newBox, label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Room</Label>
                <Input placeholder="e.g. Kitchen" value={newBox.room} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBox({ ...newBox, room: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contents</Label>
              <Input placeholder="Describe what's in the box" value={newBox.contents} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBox({ ...newBox, contents: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fragile" className="rounded" checked={newBox.isFragile} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBox({ ...newBox, isFragile: e.target.checked })} />
                <Label htmlFor="fragile">Fragile</Label>
              </div>
            </div>
            <Button size="sm" onClick={handleAddBox} disabled={saving || !newBox.label}>
              {saving ? "Saving..." : "Save Box"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Box Grid */}
      {boxes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No boxes yet. Add your first box!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((box: Box) => (
            <Card key={box.id} className={box.isPacked ? "border-success/30 bg-success/5" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">Box #{box.boxNumber}</p>
                    <p className="font-medium text-sm">{box.label}</p>
                  </div>
                  <div className="flex gap-1">
                    {box.isFragile && <Badge variant="destructive" className="text-[9px]">Fragile</Badge>}
                    <Badge variant={box.isPacked ? "success" : "secondary"} className="text-[9px]">
                      {box.isPacked ? "Packed" : "Not Packed"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{box.room}</p>
                {box.contents && <p className="text-xs text-muted-foreground line-clamp-2">{box.contents}</p>}
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => togglePacked(box.id)}>
                    <Package className="h-3 w-3 mr-1" />
                    {box.isPacked ? "Unpack" : "Mark Packed"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setQrBox(box)}>
                    <QrCode className="h-3 w-3 mr-1" />QR
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {qrBox && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setQrBox(null)}>
          <div className="bg-background rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Box #{qrBox.boxNumber} — {qrBox.label}</h3>
              <Button variant="ghost" size="sm" onClick={() => setQrBox(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: generateQRSvg(sanitizeQRData(`BOX-${qrBox.id}-${qrBox.boxNumber}-${qrBox.label}`), 200) }} />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{qrBox.label}</p>
              {qrBox.room && <p className="text-xs text-muted-foreground">Room: {qrBox.room}</p>}
              {qrBox.contents && <p className="text-xs text-muted-foreground line-clamp-2">{qrBox.contents}</p>}
              {qrBox.isFragile && <Badge variant="destructive" className="text-[9px]">⚠ Fragile</Badge>}
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const svg = generateQRSvg(sanitizeQRData(`BOX-${qrBox.id}-${qrBox.boxNumber}-${qrBox.label}`), 400);
                const blob = new Blob([svg], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `box-${qrBox.boxNumber}-qr.svg`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-3 w-3 mr-1" />Download SVG
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const printWin = window.open("", "_blank");
                if (printWin) {
                  const svg = generateQRSvg(sanitizeQRData(`BOX-${qrBox.id}-${qrBox.boxNumber}-${qrBox.label}`), 300);
                  printWin.document.write(`<html><head><title>Box #${escapeHtml(String(qrBox.boxNumber))}</title></head><body style="text-align:center;font-family:sans-serif;padding:40px">${svg}<h2>Box #${escapeHtml(String(qrBox.boxNumber))} — ${escapeHtml(qrBox.label)}</h2><p>${escapeHtml(qrBox.room || "")}</p><p style="font-size:12px;color:#666">${escapeHtml(qrBox.contents || "")}</p>${qrBox.isFragile ? '<p style="color:red;font-weight:bold">⚠ FRAGILE</p>' : ""}</body></html>`);
                  printWin.document.close();
                  printWin.print();
                }
              }}>
                <Printer className="h-3 w-3 mr-1" />Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
