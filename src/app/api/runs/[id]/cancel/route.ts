import { abortRun } from "@/lib/run-registry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const aborted = abortRun(id);
  return Response.json({ aborted });
}
