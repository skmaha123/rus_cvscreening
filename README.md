# RUAS Faculty CV Screening Dashboard (UGC / AICTE)

A browser-based screening aid for faculty recruitment at Ramaiah University of Applied Sciences. It reads candidate CVs, extracts qualifications, experience, publications and Ph.D. guidance, and checks each candidate against the applicable regulations for **Assistant Professor, Associate Professor and Professor**.

**Privacy:** CVs are processed only in the browser. Nothing is uploaded.

## Regulations applied (see `rules.js`)
- **UGC Regulations, 18 July 2018** (with the 2nd Amendment, 2023: NET/SET/SLET is the minimum for Assistant Professor and Ph.D. holders are exempt). Used for Sciences, Humanities, Commerce and similar disciplines.
- **AICTE Regulations, 1 March 2019**: Engineering & Technology, MCA, Management.
- **Pay levels**: 7th CPC revision (MHRD, now the Ministry of Education), as adopted by UGC and AICTE.
- The draft UGC Regulations 2025 were released for consultation. If they are notified, update `rules.js`.

## Features
- Upload up to 60 CVs (PDF, DOCX, TXT) and, optionally, the advertisement
- Choose the discipline (which sets the regulation) and the post being screened
- Each candidate gets **Eligible / Needs verification / Not eligible**, with a ✓ / ✗ / ? for every criterion and the reason
- Shows the **highest post** each candidate may be eligible for
- **Keyword match** with the advertisement
- Click a candidate to **correct the extracted details**. The eligibility updates instantly.
- **Export to Excel** with the reasons and the regulation used

## Publish on GitHub Pages
Upload all files (there are no folders) to a public repository, then go to **Settings → Pages** and set *Deploy from a branch* → `main` → `/ (root)`.

## Important
This is a screening aid, not a decision. The scrutiny committee must verify eligibility against original documents. That includes the relevance of the discipline, a recognised university, a regular-mode Ph.D., the UGC research score, age limits and the reservation roster.
