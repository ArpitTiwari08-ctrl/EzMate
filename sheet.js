export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const response = await fetch(
      "https://api.sheetbest.com/sheets/578f6242-bd5a-4373-8096-2a7c7c6bae62",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    const result = await response.text();
    res.status(response.status).send(result);

  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
}
