import React, { useEffect, useState } from 'react';
import LegalLayout from './LegalLayout';

/*
 * The public privacy notice at /privacy. This is the long text behind the link
 * "Išsamiau apie asmens duomenų tvarkymą" in the app and on the guest form.
 *
 * Source: code/legal/privacy-notice-lt.md (the original) and
 * privacy-notice-en.md (its translation). Change the text there first, then
 * here, and keep the two languages section for section.
 *
 * Language: ?lang=lt or ?lang=en wins, otherwise the browser language. The
 * section ids are the same in both languages, so a link such as
 * /privacy?lang=en#section-6 works for either.
 */

const LINK =
  'font-semibold text-[#78003F] underline decoration-[#E64164]/40 hover:decoration-[#E64164]';

function Mail({ to }) {
  return (
    <a href={`mailto:${to}`} className={LINK}>
      {to}
    </a>
  );
}

function Web({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={LINK}>
      {children}
    </a>
  );
}

// A link to another section of this page, e.g. "(9 skyrius)".
function Ref({ to, children }) {
  return (
    <a href={`#section-${to}`} className={LINK}>
      {children}
    </a>
  );
}

function B({ children }) {
  return <strong className="font-semibold text-[#414141]">{children}</strong>;
}

function Section({ id, title, children }) {
  return (
    <section className="space-y-3">
      <h2 id={id} className="scroll-mt-20 text-lg font-extrabold text-[#414141]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ id, title, children }) {
  return (
    <div className="space-y-2 pt-1">
      <h3 id={id} className="scroll-mt-20 text-base font-bold text-[#414141]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ ordered = false, children }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5`}>
      {children}
    </Tag>
  );
}

// The notice's tables, drawn as one card per row so they also read on a phone.
// Every cell keeps its column name as a small label.
function Rows({ columns, rows }) {
  return (
    <div className="space-y-3">
      {rows.map((row, r) => (
        <dl
          key={r}
          className="rounded-[16px] border border-[#DCDCDC]/60 bg-[#DCDCDC]/10 p-4 space-y-2"
        >
          {columns.map((label, i) => (
            <div key={label} className="sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#414141]/60 sm:pt-0.5">
                {label}
              </dt>
              <dd className={i === 0 ? 'font-semibold text-[#414141]' : undefined}>{row[i]}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}

function Summary({ id, title, children }) {
  return (
    <section className="rounded-[16px] border border-[#78003F]/10 bg-[#78003F]/5 p-4 sm:p-5 space-y-2">
      <h2 id={id} className="scroll-mt-20 text-lg font-extrabold text-[#78003F]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Callout({ children }) {
  return (
    <p className="rounded-[16px] border border-[#E64164]/20 bg-[#E64164]/10 p-4">{children}</p>
  );
}

function BodyLt() {
  return (
    <>
      <p>
        „SimuFlow“ – tai programėlė telefonui ir svetainė www.simuflow.net. Su ja simuliacijų
        centras registruoja dalyvius, planuoja užsiėmimus ir renginius, mato, kas yra centre ir
        kas naudojasi simuliatoriais.
      </p>
      <p>
        Tekstas skirtas studentams, rezidentams, dėstytojams, centro administratoriams ir
        svečiams. „Mes“ čia reiškia Įstaigą ir „SimuFlow“ kūrėją, kuris dirba pagal jos
        nurodymus (<Ref to={1}>1 skyrius</Ref>). Duomenys tvarkomi pagal Bendrąjį duomenų
        apsaugos reglamentą (BDAR) ir kitus galiojančius teisės aktus.
      </p>

      <Summary id="summary" title="Trumpai">
        <List>
          <li>
            Už jūsų duomenis atsako universitetas ar kita įstaiga, kurios simuliacijų centru
            naudojatės (toliau – Įstaiga).
          </li>
          <li>„SimuFlow“ kūrėja Abba group, MB duomenis tvarko tik pagal Įstaigos nurodymus.</li>
          <li>Renkame tik tai, ko reikia registracijai, veikloms organizuoti ir jų apskaitai.</li>
          <li>
            Veiklų metu Įstaiga gali fotografuoti ir filmuoti. „SimuFlow“ žmonių nuotraukų ir
            vaizdo įrašų nesaugo.
          </li>
          <li>Profilį pataisyti ir paskyrą ištrinti galite patys, programėlės nustatymuose.</li>
          <li>Klausimus ir prašymus siųskite savo Įstaigos duomenų apsaugos pareigūnui.</li>
        </List>
      </Summary>

      <Section id="section-1" title="1. Kas atsako už jūsų duomenis">
        <Sub id="controller" title="Įstaiga – duomenų valdytoja">
          <p>
            Duomenų valdytojas sprendžia, kam ir kaip tvarkomi duomenys. Tai Įstaiga, kurios
            simuliacijų centru naudojatės arba kurios renginyje dalyvaujate. Jei nežinote, kuri
            tai Įstaiga, paklauskite centro darbuotojų.
          </p>
          <p>
            <B>Įstaigos, kurios naudoja „SimuFlow“</B>
          </p>
          <Rows
            columns={['Įstaiga (duomenų valdytoja)', 'Simuliacijų centras', 'Duomenų apsaugos pareigūnas']}
            rows={[
              [
                'Vilniaus universitetas, juridinio asmens kodas 211950810, Universiteto g. 3, LT-01513 Vilnius',
                'Medicinos fakulteto Medicininių simuliacijų centras, Žaliųjų Ežerų g. 2, LT-08406 Vilnius',
                <Mail to="dap@vu.lt" />,
              ],
            ]}
          />
          <p>
            Duomenų apsaugos pareigūnas – Įstaigos paskirtas asmuo, kuris prižiūri, kaip saugomi
            asmens duomenys, ir atsako į žmonių klausimus apie jų duomenis.
          </p>
        </Sub>

        <Sub id="developer" title="Abba group, MB – sistemos kūrėja">
          <p>
            Abba group, MB (juridinio asmens kodas 307518144, Plento g. 10B-34, LT-45396 Kaunas)
            sukūrė „SimuFlow“, ją prižiūri ir talpina. Duomenis ji tvarko Įstaigos vardu ir tik
            pagal jos nurodymus.
          </p>
          <p>
            Abba group, MB jūsų duomenų nenaudoja savo tikslams, reklamai ar dirbtinio intelekto
            modeliams mokyti, jų neparduoda ir neperduoda kitiems, išskyrus{' '}
            <Ref to={7}>7 skyriuje</Ref> nurodytus paslaugų teikėjus. Su konkretaus žmogaus
            duomenimis ji susipažįsta tik tada, kai reikia pašalinti gedimą, padėti naudotojui,
            užtikrinti saugumą arba kai to paprašo Įstaiga.
          </p>
          <p>
            Vienintelė išimtis – el. laiškai apie Abba group, MB veiklą, jei atskirai sutikote juos
            gauti (<Ref to={9}>9 skyrius</Ref>).
          </p>
        </Sub>
      </Section>

      <Section id="section-2" title="2. Kokius duomenis tvarkome">
        <Sub id="sign-in" title="Prisijungimas">
          <p>
            Prisijungiate per Google, per Apple arba el. pašto adresu ir slaptažodžiu. Tvarkome:
          </p>
          <List>
            <li>
              el. pašto adresą (jei per Apple jį paslepiate – Apple sukurtą persiuntimo adresą);
            </li>
            <li>prisijungimo būdą ir Google ar Apple paskyros identifikatorių;</li>
            <li>
              Google perduodamą vardą, pavardę ir profilio nuotraukos nuorodą arba Apple
              perduodamą vardą ir pavardę;
            </li>
            <li>slaptažodį – tik tokiu pavidalu, iš kurio jo atkurti negalima;</li>
            <li>
              paskyros sukūrimo ir paskutinio prisijungimo laiką, IP adresą, įrenginio ar
              naršyklės duomenis.
            </li>
          </List>
        </Sub>

        <Sub id="profile" title="Profilis">
          <p>
            Kiekvieno profilyje yra vardas, pavardė, universitetas ar kita institucija ir vaidmuo.
            Be to:
          </p>
          <List>
            <li>studento – kursas, grupė ir fakultetas;</li>
            <li>rezidento – rezidentūros specialybė;</li>
            <li>dėstytojo – klinikinės bazės;</li>
            <li>renginio svečio programėlėje – renginio kodas.</li>
          </List>
          <p>
            Rezidentams, dėstytojams ir svečiams pažymima, kuriais simuliatoriais leidžiama
            naudotis. Dėstytojo ir administratoriaus vaidmuo suteikiamas tik su Įstaigos išduotu
            kodu.
          </p>
        </Sub>

        <Sub id="website-sign-up" title="Registracija svetainėje">
          <p>
            Jei registruojatės kaip svečias svetainėje (be paskyros): vardas, pavardė, el. pašto
            adresas, šalis, institucija, registracijos laikas ir žyma, kad sutikote su naudojimosi
            taisyklėmis.
          </p>
        </Sub>

        <Sub id="short-information" title="Trumpa informacija registruojantiems">
          <p>
            Prieš registraciją parodome trumpą informaciją apie duomenų tvarkymą ir galimą
            fotografavimą. Užfiksuojame, kurią jos versiją ir kada patvirtinote, o programėlėje –
            ir kokioje sistemoje (iOS ar Android). Pasikeitus tekstui, programėlė paprašys jį
            patvirtinti iš naujo.
          </p>
        </Sub>

        <Sub id="visits" title="Apsilankymai ir simuliatoriai">
          <List>
            <li>
              Kada atėjote į centrą ir kada išėjote, su kuriuo dėstytoju atėjote (jei tai
              nurodoma). Laikas užrašomas, kai telefonu nuskaitote NFC žymą prie durų, arba jį
              įrašo centro administratorius. NFC žymos žymi duris ir simuliatorius, ne žmones. Jei
              išėjimo nepažymėjote, sistema apsilankymą uždaro pati 20 val.
            </li>
            <li>Kuriuo simuliatoriumi naudojotės, nuo kada iki kada.</li>
            <li>
              Laikini leidimai naudotis simuliatoriumi: kam leidimas suteiktas, kas jį suteikė ir
              iki kada jis galioja.
            </li>
          </List>
        </Sub>

        <Sub id="classes-events" title="Užsiėmimai ir renginiai">
          <List>
            <li>
              Užsiėmimų planai: data, laikas, kursas, grupės, simuliatoriai, patalpos, dėstytojo
              pastabos ir ar reikia simuliacijų specialisto pagalbos.
            </li>
            <li>
              Renginių kodai: pavadinimas, laikas, patalpos, renginį vedantys dėstytojai ir kodą
              sukūręs administratorius.
            </li>
          </List>
        </Sub>

        <Sub id="chat-notifications" title="Pokalbiai ir pranešimai">
          <List>
            <li>
              Pagalbos pokalbio žinutės: tekstas, kas parašė ir kada. Dėstytojo užsiėmimo plano
              pastabos ir pagalbos prašymai automatiškai patenka į jo pagalbos pokalbį.
            </li>
            <li>
              Telefono pranešimų kodas ir telefono kalba – kad pranešimai pasiektų jūsų telefoną.
              Tai ne telefono numeris.
            </li>
          </List>
        </Sub>

        <Sub id="security-records" title="Saugumo įrašai">
          <p>
            Kas ir kada gavo dėstytojo ar administratoriaus vaidmenį, nesėkmingi kodo įvedimo
            bandymai. Paslaugų teikėjų serverių žurnaluose – IP adresas, užklausos laikas ir
            adresas, naršyklės ar įrenginio duomenys.
          </p>
        </Sub>

        <Sub id="not-processed" title="Ko netvarkome">
          <p>
            Neprašome asmens kodo, telefono numerio, gimimo datos, gyvenamosios vietos adreso ir
            tikslios buvimo vietos (GPS). Netvarkome ypač jautrių duomenų (apie sveikatą, tautybę,
            religiją ir pan.) ir duomenų apie teistumą. Reklamos, analitikos ir sekimo įrankių
            sistemoje nėra.
          </p>
          <Callout>
            <B>Prašome:</B> pagalbos pokalbyje ir užsiėmimų pastabose nerašykite apie savo ar kitų
            žmonių sveikatą ir nenurodykite pacientų duomenų.
          </Callout>
        </Sub>
      </Section>

      <Section id="section-3" title="3. Kam naudojame duomenis">
        <List ordered>
          <li>
            <B>Registracija ir vaidmenys</B> – kad galėtumėte prisijungti ir naudotis tuo, kas
            skirta jūsų vaidmeniui.
          </li>
          <li>
            <B>Apsilankymų ir simuliatorių apskaita</B> – kad būtų žinoma, kas yra centre ir kas,
            kada ir kiek naudojosi įranga.
          </li>
          <li>
            <B>Užsiėmimų planavimas</B> – kad dėstytojai galėtų suplanuoti užsiėmimus, o
            simuliatoriai ir patalpos nebūtų užimti du kartus.
          </li>
          <li>
            <B>Svečiai ir renginiai</B> – svečių registracija ir renginių organizavimas.
          </li>
          <li>
            <B>Pokalbiai, pranešimai ir priminimai</B> – atsakymai į jūsų klausimus ir priminimai
            apie užsiėmimus ar renginius (paprastai likus valandai).
          </li>
          <li>
            <B>Statistika</B> – centro veiklos statistika, tik apibendrinta, pavyzdžiui,
            apsilankymų ar užsiėmimų skaičiai.
          </li>
          <li>
            <B>Priežiūra ir saugumas</B> – kad sistema veiktų, būtų saugi ir kad galėtume padėti,
            kai kas nors neveikia.
          </li>
        </List>
        <p>
          Tai ir yra trumpoje informacijoje minimi dalyvių registracijos, veiklų organizavimo ir
          apskaitos tikslai. Jokių sprendimų apie jus sistema automatiškai nepriima ir jūsų
          neprofiliuoja.
        </p>
      </Section>

      <Section id="section-4" title="4. Kuo remiamės">
        <p>
          Teisinį pagrindą kiekvienam tikslui nustato Įstaiga. Žemiau – kiekvienos Įstaigos
          pasirinkimai.
        </p>

        <Sub id="legal-basis-vu" title="Vilniaus universitetas">
          <Rows
            columns={['Tikslas', 'Teisinis pagrindas']}
            rows={[
              [
                '1. Registracija ir vaidmenys',
                'viešojo intereso užduotis – studijų organizavimas pagal Mokslo ir studijų įstatymą (e p.); svečių – teisėtas interesas (f p.)',
              ],
              [
                '2. Apsilankymų ir simuliatorių apskaita',
                'teisėtas interesas – centro saugumas, turto apsauga ir prieigos kontrolė (f p.); viešojo intereso užduotis – studijų proceso apskaita (e p.)',
              ],
              [
                '3. Užsiėmimų planavimas',
                'viešojo intereso užduotis (e p.); dėstytojų – kai taikoma, darbo sutarties vykdymas (b p.)',
              ],
              [
                '4. Svečiai ir renginiai',
                'teisėtas interesas – organizuoti renginius ir žinoti, kas juose dalyvauja (f p.)',
              ],
              [
                '5. Pokalbiai, pranešimai ir priminimai',
                'e ir f p. – laiku informuoti dalyvius ir atsakyti į jų klausimus',
              ],
              ['6. Statistika', 'e ir f p. – planuoti centro veiklą ir už ją atsiskaityti'],
              [
                '7. Priežiūra ir saugumas',
                'teisinė prievolė užtikrinti duomenų saugumą (c p. kartu su BDAR 32 str.); taip pat e arba f p.',
              ],
            ]}
          />
        </Sub>

        <p>
          Raidės reiškia BDAR 6 straipsnio 1 dalies punktus: a – sutikimas; b – sutarties
          vykdymas; c – teisinė prievolė; e – užduotis, vykdoma viešojo intereso labui; f –
          teisėtas interesas.
        </p>
        <p>
          El. laiškams apie Abba group, MB veiklą pagrindas yra tik jūsų sutikimas (a p.,{' '}
          <Ref to={9}>9 skyrius</Ref>). Dėl fotografavimo ir filmavimo sprendžia Įstaiga (
          <Ref to={6}>6 skyrius</Ref>).
        </p>

        <Sub id="must-provide" title="Ar privalote pateikti duomenis">
          <p>
            Be profilio duomenų ir trumpos informacijos patvirtinimo užsiregistruoti negalima.
            Sutikimas gauti el. laiškus – visiškai laisvas pasirinkimas.
          </p>
        </Sub>
      </Section>

      <Section id="section-5" title="5. Kas mato jūsų duomenis">
        <List>
          <li>
            <B>Jūs</B> – savo profilį ir savo duomenis programėlėje.
          </li>
          <li>
            <B>Jūsų Įstaigos centro administratoriai</B> – profilius, apsilankymus, simuliatorių
            naudojimą, užsiėmimų planus, renginius, pagalbos pokalbius ir svetainės registracijas.
          </li>
          <li>
            <B>Jūsų Įstaigos dėstytojai</B> – studentų ir rezidentų profilius, užsiėmimų planus,
            taip pat kas yra centre ir kas naudojasi simuliatoriais (ir anksčiau).
          </li>
          <li>
            <B>Studentai</B> – savo Įstaigos dėstytojų vardus ir pavardes bei užsiėmimų
            planus, kartu su dėstytojų pastabomis. Kitų studentų profilių jie nemato.
          </li>
          <li>
            <B>Abba group, MB</B> – tik <Ref to={1}>1 skyriuje</Ref> nurodytais atvejais.
          </li>
          <li>
            <B>Paslaugų teikėjai</B> – tik tiek, kiek reikia jų paslaugai (
            <Ref to={7}>7 skyrius</Ref>).
          </li>
          <li>
            <B>Valstybės institucijos</B>, pavyzdžiui, teismas, – tik kai to reikalauja įstatymas.
          </li>
        </List>
        <p>
          Kas ką mato, nustatyta pačioje duomenų bazėje pagal Įstaigą ir vaidmenį. Duomenys
          perduodami šifruotu ryšiu, duomenų bazė saugoma šifruota. Prieigą prie sistemos
          administravimo priemonių turi tik tie Abba group, MB žmonės, kuriems jos reikia darbui;
          jie privalo saugoti konfidencialumą.
        </p>
      </Section>

      <Section id="section-6" title="6. Nuotraukos ir vaizdo įrašai">
        <p>
          Veiklų metu centre gali būti fotografuojama ir filmuojama. Tai daro Įstaiga. Nuotraukos
          ir vaizdo įrašai gali būti naudojami projekto ir veiklų dokumentavimo, atsiskaitymo ir
          viešinimo tikslais. Viešinimas reiškia, kad jie gali būti paskelbti viešai, pavyzdžiui,
          Įstaigos svetainėje ar socialinių tinklų paskyrose.
        </p>
        <p>
          Tai vyksta už „SimuFlow“ ribų: Įstaiga fotografuoja ir medžiagą tvarko savo vardu ir
          pagal savo taisykles. „SimuFlow“ žmonių nuotraukų ir vaizdo įrašų nesaugo. Sistemoje yra
          tik simuliatorių nuotraukos ir, jei jungiatės per Google, nuoroda į jūsų Google profilio
          nuotrauką.
        </p>
        <p>
          Jei nenorite būti fotografuojami ar filmuojami, pasakykite tai centro darbuotojams prieš
          veiklą ar jos metu. Dėl jau padarytos medžiagos, jos teisinio pagrindo ir saugojimo
          laiko kreipkitės į savo Įstaigos duomenų apsaugos pareigūną.
        </p>
      </Section>

      <Section id="section-7" title="7. Kur saugomi duomenys ir kas padeda juos tvarkyti">
        <p>
          Sistemai veikti padeda šie paslaugų teikėjai. Jie gauna tik tai, ko reikia jų paslaugai.
        </p>
        <Rows
          columns={['Teikėjas', 'Ką daro', 'Kur']}
          rows={[
            [
              'Supabase, Inc. (JAV)',
              'duomenų bazė, prisijungimas ir jo el. laiškai, failų saugykla, serverio funkcijos',
              'duomenų bazė, prisijungimas ir failai – Stokholme, Švedijoje (Amazon Web Services, ES); serverio funkcijos ir techniniai žurnalai gali būti tvarkomi ir už EEE ribų',
            ],
            [
              'Google Ireland Limited (Airija) ir Google LLC (JAV) – Firebase Cloud Messaging',
              'pranešimų pristatymas į telefonus (į iPhone – per Apple pranešimų paslaugą)',
              'Google infrastruktūra, taip pat už EEE ribų',
            ],
            ['Railway Corporation (JAV)', 'svetainės talpinimas', 'Nyderlanduose (ES)'],
            [
              'Cloudflare, Inc. (JAV)',
              'svetainės adresas (DNS), tarpinis serveris, apsauga nuo atakų',
              'pasaulinis tinklas, taip pat už EEE ribų',
            ],
          ]}
        />
        <p>
          EEE – Europos ekonominė erdvė: ES šalys, Islandija, Lichtenšteinas ir Norvegija. Kai
          duomenys tvarkomi už jos ribų, juos saugo Europos Komisijos patvirtintos standartinės
          sutarčių sąlygos (Sprendimas (ES) 2021/914) – jos taikomos visiems keturiems teikėjams.
          Google LLC ir Cloudflare, Inc. taip pat sertifikuotos pagal ES ir JAV duomenų privatumo
          sistemą (Komisijos sprendimas (ES) 2023/1795). Daugiau apie šias priemones galite
          sužinoti iš Įstaigos duomenų apsaugos pareigūno.
        </p>
        <p>
          <B>Kas būna pranešime telefone.</B> Priminime apie užsiėmimą – laikas, dėstytojo vardas
          ir pavardė, kursas, grupės ir patalpos, apie renginį – laikas, pavadinimas, vedantys
          dėstytojai ir patalpos. Pranešime apie naują pagalbos pokalbio žinutę gali būti
          siuntėjo vardas ir žinutės pradžia.
        </p>
        <p>
          <B>Ką pasirenkate patys.</B> Jei jungiatės per Google ar Apple, šios įmonės jūsų
          duomenis tvarko pagal savo taisykles, kaip atskiri duomenų valdytojai. Tas pats galioja
          App Store ir Google Play, iš kurių atsisiunčiate programėlę.
        </p>
      </Section>

      <Section id="section-8" title="8. Kiek laiko saugome duomenis">
        <p>
          Saugojimo terminus nustato Įstaiga. Ji gali nustatyti ir trumpesnius, nei nurodyta čia.
        </p>
        <List>
          <li>
            <B>
              Paskyra, prisijungimas, profilis, pagalbos pokalbis, trumpos informacijos
              patvirtinimai ir laikini leidimai
            </B>{' '}
            – kol turite paskyrą. Ištrinami kartu su ja.
          </li>
          <li>
            <B>Telefono pranešimų kodas</B> – kol esate prisijungę tame telefone. Ištrinamas
            atsijungus, ištrynus paskyrą arba kodui nustojus veikti.
          </li>
          <li>
            <B>Dėstytojo užsiėmimų planai</B> – kol yra dėstytojo paskyra. Ištrinami kartu su ja.
          </li>
          <li>
            <B>Apsilankymų, simuliatorių naudojimo ir vaidmenų suteikimo įrašai</B> – tai Įstaigos
            apskaita, todėl ištrynus paskyrą jie lieka. Juose nebelieka nei vardo, nei pavardės,
            nei el. pašto adreso – tik vidinis numeris, kurio sistemoje nebėra su kuo susieti. Kiek
            laiko juos saugoti, sprendžia Įstaiga.
          </li>
          <li>
            <B>Renginių kodai ir registracijos svetainėje</B> – kol jų reikia renginiams
            organizuoti ir apskaitai. Terminą nustato Įstaiga. Savo registraciją galite paprašyti
            ištrinti anksčiau (<Ref to={10}>10 skyrius</Ref>).
          </li>
          <li>
            <B>Techniniai žurnalai</B> – tiek, kiek nustato paslaugų teikėjai.
          </li>
        </List>
        <p>
          Ištrinti duomenys dar kurį laiką gali likti paslaugų teikėjų techninėse atsarginėse
          kopijose ir žurnaluose, kol šie bus perrašyti.
        </p>
      </Section>

      <Section id="section-9" title="9. El. laiškai apie Abba group, MB veiklą (neprivaloma)">
        <p>
          Registruodamiesi programėlėje ar svetainėje matysite atskirą, iš anksto nepažymėtą
          langelį. Jį pažymėję sutinkate el. paštu gauti Abba group, MB informaciją apie jos
          produktus, paslaugas, mokymus ir renginius. Programėlėje sutikti galite ir vėliau,
          nustatymuose.
        </p>
        <List>
          <li>
            <B>Siunčia Abba group, MB, ne Įstaiga.</B> Šiems duomenims Abba group, MB yra
            savarankiška duomenų valdytoja, pagrindas – jūsų sutikimas. Įstaiga šių duomenų
            negauna.
          </li>
          <li>
            <B>Naudojami tik</B> vardas, pavardė, el. pašto adresas ir kalba. Kursas, grupė,
            apsilankymai, pokalbiai ir kiti sistemos duomenys laiškams nenaudojami. Laiškams
            siųsti gali būti pasitelktas el. laiškų siuntimo paslaugos teikėjas – jis gauna tik
            šiuos duomenis.
          </li>
          <li>
            <B>Sutikti gali tik</B> asmuo, kuriam sukako 18 metų.
          </li>
          <li>
            <B>Nesutikus</B> niekas nepasikeis: tai neturi jokios įtakos studijoms, darbui ar
            naudojimuisi programėle.
          </li>
          <li>
            <B>Atšaukti galite bet kada:</B> programėlės nustatymuose išjunkite jungiklį „Receive
            emails and updates“ (gauti el. laiškus ir naujienas) arba paspauskite atsisakymo
            nuorodą bet kuriame tokiame laiške. Po to laiškai nebesiunčiami.
          </li>
          <li>
            <B>Duomenys saugomi</B>, kol sutikimas galioja. Įrodymus, kada sutikote ir kada
            atšaukėte, Abba group, MB gali saugoti iki 3 metų po atšaukimo – tik galimiems
            ginčams spręsti.
          </li>
          <li>
            <B>Ištrynus paskyrą,</B> sutikimo žyma sistemoje ištrinama. Jei jūsų duomenys jau
            buvo perduoti Abba group, MB laiškams siųsti, sutikimas galioja, kol jo neatšauksite.
            Todėl, jei laiškų nebenorite, prieš trindami paskyrą išjunkite jungiklį.
          </li>
          <li>
            <B>Klausimai</B> dėl šių laiškų – Abba group, MB, Plento g. 10B-34, LT-45396 Kaunas.
          </li>
        </List>
      </Section>

      <Section id="section-10" title="10. Jūsų teisės">
        <p>Galite:</p>
        <List>
          <li>
            <B>susipažinti</B> su savo duomenimis ir gauti jų kopiją;
          </li>
          <li>
            <B>ištaisyti</B> neteisingus ar netikslius duomenis;
          </li>
          <li>
            <B>prašyti ištrinti</B> duomenis, kai jų nebereikia arba nėra pagrindo juos tvarkyti;
          </li>
          <li>
            <B>prašyti apriboti</B> tvarkymą, pavyzdžiui, kol tikrinama, ar duomenys teisingi;
          </li>
          <li>
            <B>nesutikti</B> su tvarkymu, kuris grindžiamas viešojo intereso užduotimi ar teisėtu
            interesu;
          </li>
          <li>
            <B>gauti savo duomenis</B> kompiuteriu skaitomu formatu ir perduoti juos kitam, kai jie
            tvarkomi jūsų sutikimu ar pagal sutartį;
          </li>
          <li>
            <B>atšaukti sutikimą</B> bet kada; tai nepakeičia to, kas padaryta iki atšaukimo.
          </li>
        </List>
        <p>
          Kai kurios teisės turi išimčių. Pavyzdžiui, Įstaiga gali neištrinti duomenų, kuriuos
          privalo saugoti pagal įstatymus.
        </p>

        <Sub id="self-service" title="Ką galite padaryti patys">
          <List>
            <li>
              <B>Pataisyti profilį</B> – programėlės nustatymuose.
            </li>
            <li>
              <B>Ištrinti paskyrą</B> – Nustatymai → Ištrinti paskyrą (Delete Account). Ištrinami
              profilis, prisijungimas, pagalbos pokalbis, telefono pranešimų kodai ir laikini
              leidimai, o dėstytojo – ir jo užsiėmimų planai (jie dingsta iš studentų
              tvarkaraščių). Kas lieka, parašyta <Ref to={8}>8 skyriuje</Ref>. Ištrynimo atšaukti
              negalima.
            </li>
            <li>
              <B>Atnaujinkite programėlę.</B> Senesnėse versijose šis mygtukas ištrina tik
              profilį, o prisijungimo įrašas su el. pašto adresu lieka. Jei taip nutiko,
              parašykite Įstaigos duomenų apsaugos pareigūnui.
            </li>
          </List>
        </Sub>

        <Sub id="request" title="Kaip pateikti prašymą">
          <p>
            Rašykite savo Įstaigos duomenų apsaugos pareigūnui (
            <Ref to={1}>1 skyriaus lentelė</Ref>). Geriausia – iš to el. pašto adreso, kurį
            naudojate „SimuFlow“: taip lengviau įsitikinti, kad prašymas jūsų. Įstaiga atsako per
            vieną mėnesį. Sudėtingais atvejais terminas gali būti pratęstas dar dviem mėnesiais –
            apie tai jums bus pranešta.
          </p>
          <p>
            Jei prašymą gaus Abba group, MB, ji jį persiųs jūsų Įstaigai. Svetainėje užsiregistravę
            svečiai paskyros neturi – registracijos ištrynimo prašykite Įstaigos duomenų apsaugos
            pareigūno.
          </p>
        </Sub>

        <Sub id="complaint" title="Skundas">
          <p>
            Galite pateikti skundą Valstybinei duomenų apsaugos inspekcijai (L. Sapiegos g. 17,
            LT-10312 Vilnius, <Mail to="ada@ada.lt" />,{' '}
            <Web href="https://www.vdai.lrv.lt">www.vdai.lrv.lt</Web>) arba kitos ES šalies,
            kurioje gyvenate ar dirbate, priežiūros institucijai. Pirmiausia siūlome kreiptis į
            Įstaigos duomenų apsaugos pareigūną – dažniausiai taip greičiausia.
          </p>
        </Sub>
      </Section>

      <Section id="section-11" title="11. Pakeitimai">
        <p>
          Pakeitus šį tekstą, viršuje bus nurodyta nauja data. Jei pasikeis trumpa informacija
          registruojantiems, programėlė paprašys ją patvirtinti iš naujo.
        </p>
        <p>
          Tekstas parengtas lietuvių kalba, anglų kalbos versija yra vertimas. Jei jos skiriasi,
          vadovaujamasi lietuviška.
        </p>
      </Section>
    </>
  );
}

function BodyEn() {
  return (
    <>
      <p>
        SimuFlow is a phone app and the website www.simuflow.net. A simulation centre uses it to
        register participants, plan classes and events, and see who is in the centre and who is
        using the simulators.
      </p>
      <p>
        This text is for students, residents, teachers, centre administrators and guests. "We"
        here means the Institution and the SimuFlow developer, who works on its instructions (
        <Ref to={1}>section 1</Ref>). Data is processed under the General Data Protection
        Regulation (GDPR) and other applicable law.
      </p>

      <Summary id="summary" title="In short">
        <List>
          <li>
            The university or other institution whose simulation centre you use is responsible
            for your data (the "Institution").
          </li>
          <li>
            The SimuFlow developer, Abba group, MB, processes data only on the Institution's
            instructions.
          </li>
          <li>
            We collect only what is needed for registration, organising activities and keeping
            records of them.
          </li>
          <li>
            The Institution may take photos and video during activities. SimuFlow does not store
            photos or videos of people.
          </li>
          <li>
            You can correct your profile and delete your account yourself, in the app's settings.
          </li>
          <li>Send questions and requests to your Institution's data protection officer.</li>
        </List>
      </Summary>

      <Section id="section-1" title="1. Who is responsible for your data">
        <Sub id="controller" title="The Institution – the controller">
          <p>
            The controller decides why and how data is processed. This is the Institution whose
            simulation centre you use or whose event you attend. If you are not sure which
            Institution that is, ask the centre's staff.
          </p>
          <p>
            <B>Institutions that use SimuFlow</B>
          </p>
          <Rows
            columns={['Institution (controller)', 'Simulation centre', 'Data protection officer']}
            rows={[
              [
                'Vilniaus universitetas (Vilnius University), legal entity code 211950810, Universiteto g. 3, LT-01513 Vilnius',
                'Medicininių simuliacijų centras (Medical Simulation Centre), Faculty of Medicine, Žaliųjų Ežerų g. 2, LT-08406 Vilnius',
                <Mail to="dap@vu.lt" />,
              ],
            ]}
          />
          <p>
            The data protection officer is a person appointed by the Institution who oversees how
            personal data is protected and answers people's questions about their data.
          </p>
        </Sub>

        <Sub id="developer" title="Abba group, MB – the developer">
          <p>
            Abba group, MB (legal entity code 307518144, Plento g. 10B-34, LT-45396 Kaunas) built
            SimuFlow, maintains it and hosts it. It processes data on the Institution's behalf and
            only on its instructions.
          </p>
          <p>
            Abba group, MB does not use your data for its own purposes, for advertising or for
            training artificial intelligence models, does not sell it and does not pass it to
            anyone else, except the service providers listed in <Ref to={7}>section 7</Ref>. It
            looks at a particular person's data only when it has to fix a fault, help a user, keep
            the system secure, or when the Institution asks it to.
          </p>
          <p>
            The only exception is e-mails about Abba group, MB's own activities, if you have
            separately agreed to receive them (<Ref to={9}>section 9</Ref>).
          </p>
        </Sub>
      </Section>

      <Section id="section-2" title="2. What data we process">
        <Sub id="sign-in" title="Signing in">
          <p>
            You sign in with Google, with Apple, or with an e-mail address and a password. We
            process:
          </p>
          <List>
            <li>
              your e-mail address (if you hide it when signing in with Apple, the relay address
              Apple creates);
            </li>
            <li>how you sign in, and your Google or Apple account identifier;</li>
            <li>
              the first name, surname and profile picture link that Google passes on, or the first
              name and surname that Apple passes on;
            </li>
            <li>your password – only in a form from which it cannot be recovered;</li>
            <li>
              when the account was created and when you last signed in, your IP address, and
              device or browser details.
            </li>
          </List>
        </Sub>

        <Sub id="profile" title="Profile">
          <p>
            Every profile holds a first name, surname, university or other institution, and role.
            In addition:
          </p>
          <List>
            <li>a student's – year, group and faculty;</li>
            <li>a resident's – residency specialty;</li>
            <li>a teacher's – clinical sites;</li>
            <li>an event guest's in the app – the event code.</li>
          </List>
          <p>
            For residents, teachers and guests the profile also records which simulators they may
            use. The teacher and administrator roles are given only with a code issued by the
            Institution.
          </p>
        </Sub>

        <Sub id="website-sign-up" title="Signing up on the website">
          <p>
            If you sign up as a guest on the website (without an account): first name, surname,
            e-mail address, country, institution, the time you signed up, and a record that you
            agreed to the terms of use.
          </p>
        </Sub>

        <Sub id="short-information" title="Short information for registrants">
          <p>
            Before you register, we show you short information about data processing and possible
            photography. We record which version of it you confirmed and when, and in the app also
            on which system (iOS or Android). If the text changes, the app will ask you to confirm
            it again.
          </p>
        </Sub>

        <Sub id="visits" title="Visits and simulators">
          <List>
            <li>
              When you came to the centre and when you left, and which teacher you came with (if
              that is recorded). The time is recorded when you scan the NFC tag by the door with
              your phone, or a centre administrator enters it. The NFC tags mark doors and
              simulators, not people. If you did not record leaving, the system closes the visit
              by itself at 20:00.
            </li>
            <li>Which simulator you used, from when to when.</li>
            <li>
              Temporary permissions to use a simulator: who the permission was given to, who gave
              it, and until when it is valid.
            </li>
          </List>
        </Sub>

        <Sub id="classes-events" title="Classes and events">
          <List>
            <li>
              Class plans: date, time, year, groups, simulators, rooms, the teacher's notes, and
              whether a simulation specialist's help is needed.
            </li>
            <li>
              Event codes: name, time, rooms, the teachers leading the event, and the
              administrator who created the code.
            </li>
          </List>
        </Sub>

        <Sub id="chat-notifications" title="Chat and notifications">
          <List>
            <li>
              Support chat messages: the text, who wrote it and when. A teacher's class-plan notes
              and requests for help are posted to that teacher's support chat automatically.
            </li>
            <li>
              Your phone's notification code and the phone's language – so that notifications
              reach your phone. This is not your phone number.
            </li>
          </List>
        </Sub>

        <Sub id="security-records" title="Security records">
          <p>
            Who became a teacher or administrator and when; failed attempts to enter a code. In
            the service providers' server logs: IP address, time and address of the request,
            browser or device details.
          </p>
        </Sub>

        <Sub id="not-processed" title="What we do not process">
          <p>
            We do not ask for your personal identification number, phone number, date of birth,
            home address or precise location (GPS). We do not process highly sensitive data (about
            health, ethnic origin, religion and the like) or data about criminal convictions. The
            system has no advertising, analytics or tracking tools.
          </p>
          <Callout>
            <B>Please:</B> do not write about your own or anyone else's health, and do not give
            patient details, in the support chat or in class notes.
          </Callout>
        </Sub>
      </Section>

      <Section id="section-3" title="3. What we use the data for">
        <List ordered>
          <li>
            <B>Registration and roles</B> – so that you can sign in and use what is meant for your
            role.
          </li>
          <li>
            <B>Records of visits and simulator use</B> – so that it is known who is in the centre,
            and who used the equipment, when and for how long.
          </li>
          <li>
            <B>Class planning</B> – so that teachers can plan classes and simulators and rooms are
            not booked twice.
          </li>
          <li>
            <B>Guests and events</B> – registering guests and organising events.
          </li>
          <li>
            <B>Chat, notifications and reminders</B> – answering your questions and reminding you
            of classes or events (usually one hour before).
          </li>
          <li>
            <B>Statistics</B> – statistics on the centre's activity, only in summary form, for
            example the number of visits or classes.
          </li>
          <li>
            <B>Maintenance and security</B> – so that the system works, is secure, and we can help
            when something does not work.
          </li>
        </List>
        <p>
          These are the purposes named in the short information: registering participants,
          organising activities and keeping records of them. The system makes no automatic
          decisions about you and does not profile you.
        </p>
      </Section>

      <Section id="section-4" title="4. Our legal basis">
        <p>
          The Institution sets the legal basis for each purpose. Each Institution's choices are
          below.
        </p>

        <Sub id="legal-basis-vu" title="Vilnius University">
          <Rows
            columns={['Purpose', 'Legal basis']}
            rows={[
              [
                '1. Registration and roles',
                'a task carried out in the public interest – organising studies under the Law on Higher Education and Research (point e); for guests – legitimate interest (point f)',
              ],
              [
                '2. Records of visits and simulator use',
                "legitimate interest – the centre's safety, protection of property and access control (point f); a task in the public interest – keeping records of the study process (point e)",
              ],
              [
                '3. Class planning',
                'a task in the public interest (point e); for teachers – where applicable, performance of the employment contract (point b)',
              ],
              [
                '4. Guests and events',
                'legitimate interest – organising events and knowing who takes part (point f)',
              ],
              [
                '5. Chat, notifications and reminders',
                'points e and f – informing participants in good time and answering their questions',
              ],
              [
                '6. Statistics',
                "points e and f – planning the centre's activity and reporting on it",
              ],
              [
                '7. Maintenance and security',
                'a legal obligation to keep data secure (point c, together with GDPR Article 32); also point e or f',
              ],
            ]}
          />
        </Sub>

        <p>
          The letters refer to the points of GDPR Article 6(1): a – consent; b – performance of a
          contract; c – legal obligation; e – a task carried out in the public interest; f –
          legitimate interest.
        </p>
        <p>
          For e-mails about Abba group, MB's activities, the only basis is your consent (point a,{' '}
          <Ref to={9}>section 9</Ref>). Photography and filming are the Institution's decision (
          <Ref to={6}>section 6</Ref>).
        </p>

        <Sub id="must-provide" title="Do you have to give us the data">
          <p>
            You cannot register without the profile data and without confirming the short
            information. Agreeing to receive e-mails is entirely your choice.
          </p>
        </Sub>
      </Section>

      <Section id="section-5" title="5. Who can see your data">
        <List>
          <li>
            <B>You</B> – your own profile and your own data in the app.
          </li>
          <li>
            <B>Your Institution's centre administrators</B> – profiles, visits, simulator use,
            class plans, events, support chats and website sign-ups.
          </li>
          <li>
            <B>Your Institution's teachers</B> – students' and residents' profiles, class plans,
            and who is in the centre and who uses the simulators (including earlier visits and
            sessions).
          </li>
          <li>
            <B>Students</B> – the names of their Institution's teachers and the class plans,
            including the teachers' notes. They cannot see other students' profiles.
          </li>
          <li>
            <B>Abba group, MB</B> – only in the cases listed in <Ref to={1}>section 1</Ref>.
          </li>
          <li>
            <B>Service providers</B> – only as much as their service needs (
            <Ref to={7}>section 7</Ref>).
          </li>
          <li>
            <B>Public authorities</B>, for example a court – only when the law requires it.
          </li>
        </List>
        <p>
          Who can see what is set in the database itself, by Institution and by role. Data travels
          over encrypted connections and the database is stored encrypted. Only those people at
          Abba group, MB who need it for their work have access to the system's administration
          tools, and they are bound to keep it confidential.
        </p>
      </Section>

      <Section id="section-6" title="6. Photos and video">
        <p>
          During activities at the centre, photos and video may be taken. The Institution does
          this. The photos and video may be used to document, report on and publicise the project
          and the activities. Publicising means they may be published, for example on the
          Institution's website or social media accounts.
        </p>
        <p>
          This happens outside SimuFlow: the Institution takes the photos and handles the material
          in its own name and under its own rules. SimuFlow does not store photos or videos of
          people. The only pictures in the system are photos of simulators and, if you sign in
          with Google, a link to your Google profile picture.
        </p>
        <p>
          If you do not want to be photographed or filmed, tell the centre's staff before or
          during the activity. For material that has already been made, its legal basis and how
          long it is kept, contact your Institution's data protection officer.
        </p>
      </Section>

      <Section id="section-7" title="7. Where the data is stored and who helps process it">
        <p>
          These service providers help run the system. They receive only what their service needs.
        </p>
        <Rows
          columns={['Provider', 'What it does', 'Where']}
          rows={[
            [
              'Supabase, Inc. (USA)',
              'database, sign-in and sign-in e-mails, file storage, server functions',
              'database, sign-in and files – Stockholm, Sweden (Amazon Web Services, EU); server functions and technical logs may also be processed outside the EEA',
            ],
            [
              'Google Ireland Limited (Ireland) and Google LLC (USA) – Firebase Cloud Messaging',
              "delivering notifications to phones (to iPhones through Apple's notification service)",
              'Google infrastructure, including outside the EEA',
            ],
            ['Railway Corporation (USA)', 'hosting the website', 'the Netherlands (EU)'],
            [
              'Cloudflare, Inc. (USA)',
              "the website's address (DNS), proxy server, protection against attacks",
              'global network, including outside the EEA',
            ],
          ]}
        />
        <p>
          The EEA is the European Economic Area: the EU countries, Iceland, Liechtenstein and
          Norway. When data is processed outside it, it is protected by the standard contractual
          clauses approved by the European Commission (Decision (EU) 2021/914), which apply to all
          four providers. Google LLC and Cloudflare, Inc. are also certified under the EU-U.S. Data
          Privacy Framework (Commission Decision (EU) 2023/1795). You can find out more about
          these safeguards from your Institution's data protection officer.
        </p>
        <p>
          <B>What a phone notification contains.</B> A class reminder: the time, the teacher's
          name, year, groups and rooms; an event reminder: the time, the event name, the teachers
          leading it and the rooms. A notification about a new support chat message may contain
          the sender's name and the beginning of the message.
        </p>
        <p>
          <B>What you choose yourself.</B> If you sign in with Google or Apple, those companies
          process your data under their own rules, as separate controllers. The same applies to
          the App Store and Google Play, where you download the app.
        </p>
      </Section>

      <Section id="section-8" title="8. How long we keep the data">
        <p>
          The Institution sets the retention periods. It may also set shorter periods than those
          given here.
        </p>
        <List>
          <li>
            <B>
              Account, sign-in, profile, support chat, confirmations of the short information and
              temporary permissions
            </B>{' '}
            – while you have an account. Deleted together with it.
          </li>
          <li>
            <B>Phone notification code</B> – while you are signed in on that phone. Deleted when
            you sign out, when you delete your account, or when the code stops working.
          </li>
          <li>
            <B>A teacher's class plans</B> – while the teacher's account exists. Deleted together
            with it.
          </li>
          <li>
            <B>Records of visits, simulator use and role grants</B> – these are the Institution's
            records, so they stay after the account is deleted. They no longer contain your name,
            surname or e-mail address – only an internal number that nothing in the system links
            to any more. The Institution decides how long they are kept.
          </li>
          <li>
            <B>Event codes and website sign-ups</B> – as long as they are needed to organise
            events and keep records of them. The Institution sets the period. You can ask for your
            sign-up to be deleted earlier (<Ref to={10}>section 10</Ref>).
          </li>
          <li>
            <B>Technical logs</B> – for as long as the service providers set.
          </li>
        </List>
        <p>
          Deleted data may stay for some time in the service providers' technical backups and logs
          until these are overwritten.
        </p>
      </Section>

      <Section id="section-9" title="9. E-mails about Abba group, MB's activities (optional)">
        <p>
          When you register in the app or on the website, you will see a separate box that is not
          ticked in advance. If you tick it, you agree to receive e-mails from Abba group, MB about
          its products, services, training and events. In the app you can also agree later, in
          the settings.
        </p>
        <List>
          <li>
            <B>Abba group, MB sends them, not the Institution.</B> For this data Abba group, MB is
            an independent controller, and the basis is your consent. The Institution does not
            receive this data.
          </li>
          <li>
            <B>Only</B> your first name, surname, e-mail address and language are used. Your year,
            group, visits, chats and other system data are not used for these e-mails. A provider
            of an e-mail sending service may be used to send them – it receives only this data.
          </li>
          <li>
            <B>Only</B> a person aged 18 or over can agree.
          </li>
          <li>
            <B>If you do not agree,</B> nothing changes: it has no effect on your studies, your
            work or your use of the app.
          </li>
          <li>
            <B>You can withdraw at any time:</B> in the app's settings, switch off "Receive emails
            and updates", or click the unsubscribe link in any such e-mail. After that, the
            e-mails stop.
          </li>
          <li>
            <B>The data is kept</B> while your consent is valid. Abba group, MB may keep proof of
            when you agreed and when you withdrew for up to 3 years after you withdraw – only to
            deal with possible disputes.
          </li>
          <li>
            <B>If you delete your account,</B> the consent record in the system is deleted. If
            your data has already been passed to Abba group, MB for sending e-mails, your consent
            stays valid until you withdraw it. So if you no longer want the e-mails, switch off
            the setting before you delete your account.
          </li>
          <li>
            <B>Questions</B> about these e-mails – Abba group, MB, Plento g. 10B-34, LT-45396
            Kaunas.
          </li>
        </List>
      </Section>

      <Section id="section-10" title="10. Your rights">
        <p>You can:</p>
        <List>
          <li>
            <B>access</B> your data and get a copy of it;
          </li>
          <li>
            <B>correct</B> data that is wrong or incomplete;
          </li>
          <li>
            <B>ask for erasure</B> of data that is no longer needed or that there is no basis to
            process;
          </li>
          <li>
            <B>ask for restriction</B> of processing, for example while it is being checked
            whether the data is correct;
          </li>
          <li>
            <B>object</B> to processing that rests on a task in the public interest or on
            legitimate interest;
          </li>
          <li>
            <B>get your data</B> in a machine-readable format and pass it on to someone else,
            where it is processed on the basis of your consent or a contract;
          </li>
          <li>
            <B>withdraw your consent</B> at any time; this does not change what was done before
            you withdrew it.
          </li>
        </List>
        <p>
          Some rights have exceptions. For example, the Institution may keep data that the law
          requires it to keep.
        </p>

        <Sub id="self-service" title="What you can do yourself">
          <List>
            <li>
              <B>Correct your profile</B> – in the app's settings.
            </li>
            <li>
              <B>Delete your account</B> – Settings → Delete Account. This deletes your profile,
              your sign-in, your support chat, your phones' notification codes and temporary
              permissions, and for a teacher also their class plans (they disappear from the
              students' timetables). What stays is described in <Ref to={8}>section 8</Ref>.
              Deletion cannot be undone.
            </li>
            <li>
              <B>Update the app.</B> In older versions this button deletes only the profile, and
              the sign-in record with your e-mail address stays. If that happened to you, write to
              your Institution's data protection officer.
            </li>
          </List>
        </Sub>

        <Sub id="request" title="How to make a request">
          <p>
            Write to your Institution's data protection officer (
            <Ref to={1}>table in section 1</Ref>). It is best to write from the e-mail address you
            use in SimuFlow: that makes it easier to confirm the request is yours. The Institution
            answers within one month. In complex cases this can be extended by two more months –
            you will be told if it is.
          </p>
          <p>
            If Abba group, MB receives your request, it will forward it to your Institution.
            Guests who signed up on the website have no account – to have your sign-up deleted,
            write to the Institution's data protection officer.
          </p>
        </Sub>

        <Sub id="complaint" title="Complaints">
          <p>
            You can complain to the State Data Protection Inspectorate (Valstybinė duomenų
            apsaugos inspekcija, L. Sapiegos g. 17, LT-10312 Vilnius, <Mail to="ada@ada.lt" />,{' '}
            <Web href="https://www.vdai.lrv.lt">www.vdai.lrv.lt</Web>), or to the supervisory
            authority of the EU country where you live or work. We suggest contacting your
            Institution's data protection officer first – that is usually the quickest way.
          </p>
        </Sub>
      </Section>

      <Section id="section-11" title="11. Changes">
        <p>
          When this text changes, the new date will be shown at the top. If the short information
          for registrants changes, the app will ask you to confirm it again.
        </p>
        <p>
          This text was written in Lithuanian; the English version is a translation. If they
          differ, the Lithuanian version applies.
        </p>
      </Section>
    </>
  );
}

const CONTENT = {
  lt: {
    label: 'Lietuvių',
    title: 'Informacija apie asmens duomenų tvarkymą „SimuFlow“ sistemoje',
    updated: 'Atnaujinta 2026 m. spalio 13 d.',
    Body: BodyLt,
  },
  en: {
    label: 'English',
    title: 'How SimuFlow processes personal data',
    updated: 'Updated 13 October 2026',
    Body: BodyEn,
  },
};

function initialLang() {
  const fromUrl = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase();
  if (CONTENT[fromUrl]) return fromUrl;
  return (navigator.language || '').toLowerCase().startsWith('lt') ? 'lt' : 'en';
}

function LanguageToggle({ lang, onChange }) {
  return (
    <div
      role="group"
      aria-label="Kalba / Language"
      className="inline-flex rounded-full border border-[#DCDCDC] bg-[#FFFFFF] p-1"
    >
      {Object.entries(CONTENT).map(([code, t]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => onChange(code)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
            lang === code
              ? 'bg-[#78003F] text-[#FFFFFF]'
              : 'text-[#414141]/70 hover:text-[#414141]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function PrivacyNotice() {
  const [lang, setLang] = useState(initialLang);
  const t = CONTENT[lang];

  // Screen readers and hyphenation follow the language shown.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  // The text is drawn after the browser has looked for #section-N, so a link
  // to a section would open at the top. Look for it again once it exists.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  // Back and Forward step through the section links, and an older step can
  // still carry the other ?lang=. Show the language the address asks for.
  useEffect(() => {
    const onPopState = () => setLang(initialLang());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const changeLang = (next) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    // Keep the router's own history state, so Back still works.
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <LegalLayout title={t.title}>
      <div className="space-y-8 text-sm leading-relaxed text-[#414141]/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[#414141]/60">{t.updated}</p>
          <LanguageToggle lang={lang} onChange={changeLang} />
        </div>

        <t.Body />
      </div>
    </LegalLayout>
  );
}
