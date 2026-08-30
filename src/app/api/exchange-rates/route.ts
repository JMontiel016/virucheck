import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Error fetching rates" }, { status: 500 });
  }
}