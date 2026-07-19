const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "N/A";

async function getCompetitions(page = 1) {
  try {
    const url = new URL(
      "https://unstop.com/api/public/opportunity/search-result",
    );

    url.searchParams.set("opportunity", "competitions");
    url.searchParams.set("oppstatus", "open");
    url.searchParams.set("usertype", "students");
    url.searchParams.set("sortBy", "");
    url.searchParams.set("orderBy", "");
    url.searchParams.set("page", page);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://unstop.com/competitions",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const events = data.data.data;
    console.log(events.length);
    // console.log(events[0]);
    // for (const event of events) {
    //   console.log("Status:", event.status);

    //   console.log("Start:", formatDate(event.regnRequirements?.start_regn_dt));
    //   console.log("Deadline:", formatDate(event.regnRequirements?.end_regn_dt));
    //   console.log("");
    //   // console.log("End Date:", formatDate(event.end_date));
    //   //   console.log("\nEvent");
    //   //   console.log("End Date:", event.end_date);
    //   //   console.log("Updated At:", event.updated_at);

    //   //   console.log("\nURL:", event.seo_url);
    // }
  } catch (err) {
    console.error(err);
  }
}

getCompetitions(5);
