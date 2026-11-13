import { Link } from "react-router-dom";
import { Addr, Ctl, LegalLayout, Mail, RETENTION_EN } from "@/pages/legalShared";

// English versions of the legal pages in Legal.jsx. Keep both in sync when a text changes.

export function PrivacyEn() {
  return (
    <LegalLayout title="Privacy Policy">
      <div className="legal-box">
        <p>
          <b>In short:</b> No accounts. We process only the minimum data needed for you to use a room and delete it automatically within a
          short time. The mobile app may show non-personalised ads (InMobi) on screens outside rooms; there are no ads while you watch. A
          random device ID is assigned to your phone for invitation notifications. We do not sell your data.
        </p>
      </div>
      <h2>1. Who we are</h2>
      <p>
        Nexora Watch is a watch-together video app developed and operated by <Ctl /> (mobile app and nexora.lenstedreal.info). This policy
        applies to both the mobile app and the website. Contact: <Mail />
        <Addr />.
      </p>
      <h2>2. Data we process</h2>
      <ul>
        <li>
          <b>Nickname and room details:</b> the nickname you enter, the name and code of the room you create or join, your participant ID
          and online status.
        </li>
        <li>
          <b>Chat content:</b> the messages and emoji reactions you send in a room.
        </li>
        <li>
          <b>Shared content:</b> video links added to the room; video files you upload; public files imported from Google Drive; the address
          of a video detected in the in-app browser and the address of the page it is on.
        </li>
        <li>
          <b>Technical data:</b> IP address, request time, standard connection information sent by your device/browser, and sync
          measurements (network latency, playback drift, number of reconnections, number of player errors).
        </li>
        <li>
          <b>Anonymous device ID and notification token:</b> the app and the website create a random device ID that is not linked to your
          name. If you allow notifications, your phone's notification token (Firebase) is stored with this ID. It is also used to keep the
          latest nicknames of people you watched with in the same room for at least 2 minutes ("People you watched with") and the
          invitations sent; only the two parties can see these, and you can delete them at any time.
        </li>
        <li>
          <b>Things added to a room:</b> links added to the queue and votes; uploaded subtitle files; if the host makes the room public, the
          room name, the title of the video playing and the number of people are visible to everyone in the "Open rooms" list on the home
          page.
        </li>
        <li>
          <b>Error reports:</b> if the app or the website runs into an error, the error message, technical trace, page, app version and
          browser information are sent. They contain no personal information.
        </li>
        <li>
          <b>Subscription services (beta):</b> Netflix, Disney+, Prime Video or HBO Max are watched inside the app with your own account.
          You sign in directly on the service's page; your password and the service's cookies stay only on your phone and never reach us. We
          only sync play, pause and position information with the room.
        </li>
        <li>
          <b>Reports:</b> when you report a message or a person: the reason for the report, your note, a copy of the message concerned and
          the nicknames.
        </li>
        <li>
          <b>Stored on your device:</b> so that you can reconnect to a room, the room key (token), your nickname, recent rooms and your
          consent choices are kept only on your device (encrypted storage on mobile, browser storage on the web).
        </li>
      </ul>
      <p>
        We <b>do not collect</b> your name, email address, phone number, location, contacts, camera or microphone data. When you pick a video
        from your gallery, only the file you choose is accessed.
      </p>
      <h2>3. Purposes and legal grounds</h2>
      <ul>
        <li>Providing room creation, joining, chat and synchronised playback (performance of a contract).</li>
        <li>Enabling video upload and playback, and preventing abuse and overload (performance of a contract, legitimate interest).</li>
        <li>Security, debugging, and measuring and improving sync quality (legitimate interest).</li>
        <li>Sending room invitation notifications, only if you allow notifications (explicit consent; can be turned off in Settings).</li>
        <li>Showing ads outside rooms so the mobile app can be offered free of charge (legitimate interest).</li>
        <li>
          Reviewing reports, handling copyright and unlawful-content notices, and meeting legal obligations (legal obligation, legitimate
          interest).
        </li>
      </ul>
      <h2>4. Retention periods</h2>
      {RETENTION_EN}
      <h2>5. Sharing and service providers</h2>
      <ul>
        <li>
          <b>Oracle Cloud Infrastructure</b> (Frankfurt, Germany): server, database and video storage infrastructure. Your data is therefore
          hosted abroad.
        </li>
        <li>
          <b>Cloudflare</b>: domain name (DNS) resolution.
        </li>
        <li>
          <b>Google Firebase Cloud Messaging</b>: only if you have allowed notifications, the notification token and the notification text are
          sent to Google to deliver the invitation notification to your phone.
        </li>
        <li>
          <b>InMobi</b> (ad network; mobile app only, on screens outside rooms): ads are not personalised; the app does not send an
          advertising ID or any other device identifier to InMobi. To serve ads, InMobi may process technical data such as IP address and
          device/app information under its own privacy policy.
        </li>
        <li>
          <b>Video providers</b> (YouTube, TikTok, Facebook, Twitch, Vimeo): when a video from one of these sources is played in a room, the
          provider's official player is loaded and the provider may process data under its own privacy policy.
        </li>
        <li>
          <b>YouTube (Google)</b>: when a YouTube video is played in a room, the official YouTube player is loaded and YouTube may process data
          under its own privacy policy. When a Google Drive link is imported, our server downloads the file from Google.
        </li>
        <li>Other participants in the room: your nickname, your messages and the content you add to the room are visible to everyone in the room.</li>
        <li>Competent public authorities: only when there is a legal obligation.</li>
      </ul>
      <p>We do not sell, rent or transfer your data to third parties for advertising or marketing purposes.</p>
      <p>
        <b>Ads:</b> There are no ads on the website. In the mobile app, InMobi ads may be shown only on screens outside rooms (one banner on
        the home page, and a full-screen ad at most once every 3 minutes after you leave a room); there are never ads while you watch. Ads are
        not personalised.
      </p>
      <h2>6. Security</h2>
      <p>
        All connections are encrypted with HTTPS/WSS. Room keys are stored on the server only as hashes. Video addresses are time-limited and
        signed; people outside the room cannot access them. No system is entirely risk-free; in the event of a breach we will notify within
        the statutory time limits.
      </p>
      <h2>7. Children</h2>
      <p>
        Nexora Watch is not intended for users under 16; users under 18 should use the service under the supervision of a parent or guardian.
        If we become aware that data belonging to a user under 16 is being processed, we delete it. For details, see{" "}
        <Link to="/cocuk-guvenligi">Child Safety Standards</Link>.
      </p>
      <h2>8. Your rights</h2>
      <p>
        You can access, correct and delete your data, object to its processing, and exercise the other rights listed in Article 11 of the
        KVKK. As there are no accounts, it is enough to state your room code and nickname in your request:{" "}
        <Link to="/veri-silme">Data Deletion Request</Link>, <Link to="/kvkk">KVKK Information Notice</Link>.
      </p>
      <h2>9. Changes</h2>
      <p>We may update this policy; we will announce significant changes through the app or the website. The current version is always on this page.</p>
    </LegalLayout>
  );
}

export function TermsEn() {
  return (
    <LegalLayout title="Terms of Use">
      <p>By using Nexora Watch (mobile app and website) you accept these terms. If you do not accept them, do not use the service.</p>
      <h2>1. Eligibility</h2>
      <p>
        You must be at least 16 years old to use the service. If you are under 18, you may use the service only with the permission and
        under the supervision of your parent or guardian.
      </p>
      <h2>2. The service</h2>
      <p>
        Nexora Watch lets you create rooms, join with a code, chat, react, and play videos added to a room in sync across participants. Rooms
        expire after 24 hours. The service is provided "as is"; it is not guaranteed to work without interruption or errors, and features may
        change without prior notice.
      </p>
      <h2>3. Content and copyright responsibility</h2>
      <ul>
        <li>The user who adds content to a room (a link, upload, import or detected video) is responsible for it.</li>
        <li>You may only add content that you own, have licensed, or that the rights holder has allowed to be shared publicly.</li>
        <li>
          Taking content from encrypted (DRM) platforms or platforms protected by a subscription/personal account (e.g. Netflix, Disney+,
          Prime Video, BluTV, Exxen), trying to circumvent these protections, or sharing pirated content is prohibited. The app does not
          support these platforms and blocks them.
        </li>
        <li>
          In-app video detection works only on supported public websites, and you are responsible for complying with those websites' own
          terms of use.
        </li>
        <li>
          Infringement notices are handled through the process on the <Link to="/telif">Copyright and Content Removal</Link> page.
        </li>
      </ul>
      <h2>4. Prohibited conduct</h2>
      <ul>
        <li>Any content relating to child sexual abuse or exploitation (zero tolerance; reported to the authorities).</li>
        <li>Obscene/sexual content, violence, hate speech, harassment, threats, bullying, disclosure of personal data.</li>
        <li>Sharing spam, scams, malware or malicious links.</li>
        <li>Overloading the service, bypassing security measures, using someone else's room key, or abusing the service with automated tools.</li>
        <li>Any use that violates the laws of the Republic of Türkiye or of the country you are in.</li>
      </ul>
      <h2>5. Moderation</h2>
      <p>
        You can report inappropriate messages and people from within the app, and block people on your own device. The room owner can remove
        participants from the room. We review reports; when we find a violation, we may remove the content, close the room and restrict
        access.
      </p>
      <h2>6. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by applicable law, we are not liable for damages arising from content added by users, third-party
        websites, or the service being temporarily unavailable. Cases of intent and gross negligence are excluded.
      </p>
      <h2>7. Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of Türkiye. The jurisdiction of consumer arbitration committees and consumer
        courts in consumer matters is reserved.
      </p>
      <h2>8. Contact</h2>
      <p>
        For questions and notices: <Mail />
      </p>
    </LegalLayout>
  );
}

export function KvkkEn() {
  return (
    <LegalLayout title="KVKK Information Notice">
      <p>
        This is the information notice under the Turkish Personal Data Protection Law No. 6698 ("KVKK"). Pursuant to Article 10 of the KVKK,
        as the data controller, <Ctl />
        <Addr wrap /> informs you about the personal data processed in connection with Nexora Watch.
      </p>
      <h2>1. Personal data processed</h2>
      <ul>
        <li>Identity: nickname (a real name is not required).</li>
        <li>Transaction security: IP address, participant ID, hash of the room key, activity logs.</li>
        <li>Customer transactions: room records, chat messages, added video links, report records.</li>
        <li>Visual/audio recordings: video files uploaded or imported by the user (depending on the content).</li>
        <li>
          Device information: random device ID, notification token if notifications are allowed, nicknames of people watched with and
          invitations, error reports.
        </li>
      </ul>
      <h2>2. Purposes of processing</h2>
      <p>
        Providing the service (rooms, chat, synchronised playback, video upload), ensuring information security, preventing abuse, handling
        reports and infringement notices, measuring service quality and fulfilling legal obligations.
      </p>
      <h2>3. Legal grounds (KVKK Article 5/2)</h2>
      <ul>
        <li>(c) It is directly related to the conclusion or performance of a contract.</li>
        <li>(ç) It is necessary for the data controller to fulfil its legal obligation.</li>
        <li>(e) It is necessary for the establishment, exercise or protection of a right.</li>
        <li>(f) It is necessary for the legitimate interests of the data controller, provided that it does not harm the fundamental rights and freedoms of the data subject.</li>
      </ul>
      <h2>4. Method of collection</h2>
      <p>Data is collected electronically through the mobile app and the website, by automated means and from the information you enter.</p>
      <h2>5. Transfers</h2>
      <p>
        Your personal data is stored on the servers of Oracle Cloud Infrastructure (Frankfurt, Germany), our hosting provider, and is
        therefore transferred abroad in accordance with Article 9 of the KVKK. Cloudflare is used for the DNS service. Invitation
        notifications are delivered via Google Firebase Cloud Messaging only if notifications have been allowed. InMobi is used for the ads
        shown outside rooms in the mobile app; no device identifier is sent to InMobi. When a video from a video provider (YouTube, TikTok,
        Facebook, Twitch) is added to a room, that provider's official player is loaded. Upon request, data may be shared with competent
        public authorities and institutions within legal limits. Data is not sold or transferred for advertising/marketing purposes.
      </p>
      <h2>6. Retention</h2>
      {RETENTION_EN}
      <h2>7. Your rights under Article 11 of the KVKK</h2>
      <ul>
        <li>To learn whether your personal data is processed and, if so, to request information about it,</li>
        <li>To learn the purpose of processing and whether it is used in line with that purpose,</li>
        <li>To know the third parties in Türkiye or abroad to whom it is transferred,</li>
        <li>To request its correction if it is incomplete or inaccurate,</li>
        <li>To request its deletion or destruction under the conditions of Article 7 of the KVKK,</li>
        <li>To request that corrections/deletions be notified to the third parties to whom it was transferred,</li>
        <li>To object to a result against you arising from analysis exclusively by automated systems,</li>
        <li>To claim compensation if you suffer damage due to unlawful processing.</li>
      </ul>
      <h2>8. Applications</h2>
      <p>
        You can send your requests, with the room code, your nickname and a description of your request, to <Mail />. Applications are
        concluded free of charge within 30 days at the latest. If your application is rejected or you find the response insufficient, you
        retain the right to complain to the Personal Data Protection Board (KVK Kurulu).
      </p>
    </LegalLayout>
  );
}

export function CopyrightEn() {
  return (
    <LegalLayout title="Copyright and Content Removal">
      <p>
        Nexora Watch respects intellectual property rights. Users may only add content they own or that is permitted to be shared publicly.
        Subscription/DRM-protected platforms are technically blocked.
      </p>
      <h2>Are you a rights holder? Removal notice</h2>
      <p>
        Under Turkish Law No. 5846 on Intellectual and Artistic Works and Law No. 5651, you can send a notice to <Mail /> with the following
        information:
      </p>
      <ol>
        <li>Your full name / the organisation you represent and your contact details,</li>
        <li>The work you believe is infringed and information/documents on your ownership of the rights,</li>
        <li>Identifying information such as the room code, video address or a screenshot of where the infringement took place,</li>
        <li>Your statement that the information is accurate and that you are the rights holder or an authorised representative, with the date and your signature.</li>
      </ol>
      <p>
        We review properly submitted notices as soon as possible, within 24-48 hours at the latest, and remove the content concerned or block
        access to it. Rooms and uploaded videos are in any case deleted automatically within a short time.
      </p>
      <h2>Counter-notice</h2>
      <p>
        A user who believes their content was removed by mistake can file a counter-notice to the same address, with their reasons and contact
        details. Counter-notices are forwarded to the person who sent the notice.
      </p>
      <h2>Repeat infringements</h2>
      <p>In cases of repeated infringement, we may permanently restrict access for the user and device concerned.</p>
    </LegalLayout>
  );
}

export function DeleteDataEn() {
  return (
    <LegalLayout title="Data Deletion Request">
      <div className="legal-box">
        <p>
          Nexora Watch <b>has no accounts</b>, so there is no "account" to delete. Most of your data is already deleted automatically.
        </p>
      </div>
      <h2>Automatic deletion</h2>
      {RETENTION_EN}
      <h2>Deleting the data on your device</h2>
      <ul>
        <li>
          <b>Android/iOS:</b> Uninstalling the app deletes the nickname, room keys and recent rooms on the device. You can also delete them via
          Settings → Apps → Nexora Watch → Storage → Clear data.
        </li>
        <li>
          <b>Web:</b> Clear the site data for nexora.lenstedreal.info in your browser.
        </li>
        <li>
          <b>Settings → Delete my data</b> deletes all Nexora data on this device with a single tap. You can remove people from the "People you
          watched with" list on the home page one by one or with "Forget all"; turning off notifications in Settings deletes your notification
          token from the server.
        </li>
      </ul>
      <h2>Requesting immediate deletion of data on the server</h2>
      <p>
        For room, chat, video or report records you want deleted without waiting for the automatic periods, write to <Mail /> with: the room
        code, the nickname you used, the approximate date and the data you want deleted. We will conclude your request free of charge within
        30 days at the latest and let you know the outcome. Security logs subject to a statutory retention obligation are deleted only at the
        end of the statutory period.
      </p>
    </LegalLayout>
  );
}

export function ChildSafetyEn() {
  return (
    <LegalLayout title="Child Safety Standards">
      <p>
        Nexora Watch applies a <b>zero tolerance</b> policy against child sexual abuse and exploitation (CSAE) and child sexual abuse material
        (CSAM). This page is published under Google Play's Child Safety Standards policy.
      </p>
      <h2>Our standards</h2>
      <ul>
        <li>
          The service is for users aged 16 and over; parental supervision is required for users under 18. On first launch, users are asked to
          declare their age and accept the terms.
        </li>
        <li>Any content, message or behaviour that sexualises, abuses or endangers children is prohibited.</li>
        <li>When such content is detected or reported, it is removed immediately, the room is closed and the user's access is blocked.</li>
        <li>
          Where required by law, the content and related records are preserved and reported to the competent authorities (in Türkiye the
          General Directorate of Security and the BTK reporting hotline Ihbar Web; internationally NCMEC, etc.).
        </li>
      </ul>
      <h2>Reporting</h2>
      <ul>
        <li>
          <b>In the app:</b> long-press a message → "Report"; in the People list, the menu next to the person → "Report".
        </li>
        <li>
          <b>Email:</b> <Mail /> (subject: "Child safety"). These reports are reviewed with priority, within 24 hours at the latest.
        </li>
        <li>
          If there is immediate danger, first call <b>112</b> or report it via{" "}
          <a href="https://www.ihbarweb.org.tr" target="_blank" rel="noreferrer">
            ihbarweb.org.tr
          </a>
          .
        </li>
      </ul>
      <h2>Point of contact</h2>
      <p>
        Contact person for child safety matters: <Ctl />, <Mail />.
      </p>
    </LegalLayout>
  );
}
