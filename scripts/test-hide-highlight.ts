import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db/client");
  const { user } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { getUserData } = await import("../src/lib/db/user");

  const userId = "JAXidQq5MKPam17ZJGjpsvXic2KQYx2N";
  const data = await getUserData({ id: userId });
  console.log("Current:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
