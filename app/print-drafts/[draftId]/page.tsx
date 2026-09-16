import { PrintDraftViewer } from "@/components/print-draft-viewer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Предпросмотр документа",
  robots: { index: false, follow: false },
};

export default async function PrintDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;

  return <PrintDraftViewer draftId={draftId} />;
}
