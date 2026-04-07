exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { email, phone, firstName } = JSON.parse(event.body || "{}");

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: "Email is required" }) };
  }

  const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;
  const LIST_ID = "V6vE9B";

  try {
    const profileRes = await fetch("https://a.klaviyo.com/api/profiles/", {
      method: "POST",
      headers: {
        accept: "application/json",
        revision: "2023-12-15",
        "content-type": "application/json",
        Authorization: "Klaviyo-API-Key " + KLAVIYO_API_KEY,
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email,
            phone_number: phone || undefined,
            first_name: firstName || undefined,
          },
        },
      }),
    });

    let profileId;

    if (profileRes.status === 201) {
      const profileData = await profileRes.json();
      profileId = profileData.data.id;
    } else if (profileRes.status === 409) {
      const conflictData = await profileRes.json();
      profileId = conflictData.errors && conflictData.errors[0] && conflictData.errors[0].meta && conflictData.errors[0].meta.duplicate_profile_id;
    } else {
      const err = await profileRes.text();
      console.error("Profile creation failed:", err);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to create profile" }) };
    }

    const listRes = await fetch(
      "https://a.klaviyo.com/api/lists/" + LIST_ID + "/relationships/profiles/",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          revision: "2023-12-15",
          "content-type": "application/json",
          Authorization: "Klaviyo-API-Key " + KLAVIYO_API_KEY,
        },
        body: JSON.stringify({
          data: [{ type: "profile", id: profileId }],
        }),
      }
    );

    if (listRes.status === 204 || listRes.status === 200) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
      const err = await listRes.text();
      console.error("List add failed:", err);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to add to list" }) };
    }
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};
