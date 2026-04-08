(function () {
    "use strict";

    const djDefaults = [
        {
            badge: "HEADLINER",
            name: "Acidrumm",
            style: "HARDTECHNO",
            region: "SAO PAULO - BR",
            description: "Anuncio oficial em breve.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "HARDWARE",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "Headliner HARDWARE em breve",
            logo: "assets/djs/dj1/dj1-logo.png",
            logoAlt: "Logo HARDWARE",
            video: "assets/djs/dj1/9.mp4"
        },
        {
            badge: "RESIDENT",
            name: "Markz",
            style: "INDUSTRIAL",
            region: "CAMPINAS - BR",
            description: "Texturas metalicas e groove de alta pressao para manter pista acesa.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "Markz",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 2 HARDWARE",
            logo: "assets/partners/infinity-fusion.png",
            logoAlt: "Logo artista 2",
            video: ""
        },
        {
            badge: "RESIDENT",
            name: "CHEFIN",
            style: "ACID TECHNO",
            region: "SANTOS - BR",
            description: "Linhas acidas e transicoes hipnoticas em BPM elevado.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "CHEFIN",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 3 HARDWARE",
            logo: "assets/partners/nexus-brasil.png",
            logoAlt: "Logo artista 3",
            video: ""
        },
        {
            badge: "GUEST",
            name: "NUKLEART",
            style: "RAW GROOVE",
            region: "RIO DE JANEIRO - BR",
            description: "Set cru, denso e direto para publico de pista underground.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "NUKLEART",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 4 HARDWARE",
            logo: "assets/partners/hard-federal.png",
            logoAlt: "Logo artista 4",
            video: ""
        },
        {
            badge: "GUEST",
            name: "BABY.B",
            style: "NEW RAVE",
            region: "BELO HORIZONTE - BR",
            description: "Energia rave acelerada com pegada de pista noturna.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "BABY.B",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 5 HARDWARE",
            logo: "assets/partners/infinity-fusion.png",
            logoAlt: "Logo artista 5",
            video: ""
        },
        {
            badge: "GUEST",
            name: "Monst3r",
            style: "HARD GROOVE",
            region: "CURITIBA - BR",
            description: "Grooves percussivos e conduzidos para manter o fluxo da madrugada.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "Monst3r",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 6 HARDWARE",
            logo: "assets/partners/nexus-brasil.png",
            logoAlt: "Logo artista 6",
            video: ""
        },
        {
            badge: "SHOWCASE",
            name: "Cyber Fusion",
            style: "HYPNOTIC TECHNO",
            region: "BRASILIA - BR",
            description: "Camadas profundas e narrativa progressiva para transicoes longas.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "Cyber Fusion",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 7 HARDWARE",
            logo: "assets/partners/hard-federal.png",
            logoAlt: "Logo artista 7",
            video: ""
        },
        {
            badge: "SHOWCASE",
            name: "ABIA",
            style: "INDUSTRIAL",
            region: "SOROCABA - BR",
            description: "Bassline marcada e atmosferas sombrias de assinatura industrial.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "ABIA",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 8 HARDWARE",
            logo: "assets/partners/infinity-fusion.png",
            logoAlt: "Logo artista 8",
            video: ""
        },
        {
            badge: "CLOSING",
            name: "BRWL",
            style: "HARDTECHNO",
            region: "SAO PAULO - BR",
            description: "Encerramento com drive alto e estetica dura de fim de noite.",
            previewLabel: "PLAY VIDEO",
            logoFallback: "BRWL",
            photo: "assets/img/share-placeholder.svg",
            photoAlt: "DJ 9 HARDWARE",
            logo: "assets/partners/nexus-brasil.png",
            logoAlt: "Logo artista 9",
            video: ""
        }
    ];

    const scheduleDefaults = [
        { time: "20:00", name: "Warm-Up" },
        { time: "21:00", name: "Acidrumm" },
        { time: "22:00", name: "Markz" },
        { time: "23:00", name: "CHEFIN" },
        { time: "00:00", name: "NUKLEART" },
        { time: "01:00", name: "BABY.B" },
        { time: "02:00", name: "Monst3r B2B Cyber Fusion (inedito)" },
        { time: "03:00", name: "ABIA" },
        { time: "04:00", name: "BRWL" }
    ];

    const fields = [
        {
            key: "mainTitle",
            label: "Titulo principal",
            selector: "#main-title",
            mode: "html",
            defaultValue: "HARD<span>WARE</span>"
        },
        {
            key: "footerLogo",
            label: "Logo do rodape",
            selector: ".footer-logo",
            mode: "html",
            defaultValue: "HARD<span>WARE</span>"
        },
        {
            key: "scheduleTitle",
            label: "Titulo horarios DJs",
            selector: "#dj-schedule-title",
            mode: "text",
            defaultValue: "TIMETABLE OFICIAL"
        },
        {
            key: "scheduleNote",
            label: "Observacao horarios",
            selector: "#dj-schedule-note",
            mode: "text",
            defaultValue: "A pista abre as 20h e segue ate 05h. Chegue cedo para acompanhar a progressao completa da noite."
        },
        {
            key: "partnerName1",
            label: "Parceiro 1 nome",
            selector: "#partner-name-1",
            mode: "text",
            defaultValue: "INFINITY FUSION"
        },
        {
            key: "partnerName2",
            label: "Parceiro 2 nome",
            selector: "#partner-name-2",
            mode: "text",
            defaultValue: "NEXUS BRASIL"
        },
        {
            key: "partnerName3",
            label: "Parceiro 3 nome",
            selector: "#partner-name-3",
            mode: "text",
            defaultValue: "HARD FEDERAL"
        },
        {
            key: "partnerName4",
            label: "Parceiro 4 nome",
            selector: "#partner-name-4",
            mode: "text",
            defaultValue: "SKY-NA SUSHI CLUB"
        },
    ];

    const links = [
        { key: "ticketLink", label: "Link ingressos", selector: "a[data-translate='buy']", attr: "href", defaultValue: "https://shotgun.live/pt-br/events/hardwareparty" },
        { key: "officialGroupLink", label: "Link grupo oficial", selector: "a[data-translate='group']", attr: "href", defaultValue: "https://chat.whatsapp.com/C6zI7dtX37H7d6lMpqUOi8" },
        { key: "producerLink", label: "Link produtor", selector: "#action-producer", attr: "href", defaultValue: "https://wa.me/5511916117340" },
        { key: "demoEmailLink", label: "Link envio de set", selector: "#action-demo", attr: "href", defaultValue: "mailto:hardware.partybr@gmail.com?subject=ENVIO%20DE%20SET%20-%20[NOME%20DO%20DJ]" },
        { key: "calendarLink", label: "Link adicionar calendario", selector: "a[data-translate='calendar']", attr: "href", defaultValue: "https://www.google.com/calendar/render?action=TEMPLATE&text=HARDWARE+Pocket+Edition&dates=20260410T230000Z/20260411T080000Z&details=Pocket+Edition+da+HARDWARE.+Hardtechno+e+Neo+Rave+em+S%C3%A3o+Paulo.&location=Rua+Bartolomeu+Zunega%2C+151+-+Pinheiros+-+Sao+Paulo" },
        { key: "instagramLink", label: "Instagram", selector: ".social-row a[aria-label='Instagram']", attr: "href", defaultValue: "https://instagram.com/hard.wareparty" },
        { key: "tiktokLink", label: "TikTok", selector: ".social-row a[aria-label='TikTok']", attr: "href", defaultValue: "https://tiktok.com/@hardware.party" },
        { key: "emailLink", label: "E-mail", selector: ".social-row a[aria-label='E-mail']", attr: "href", defaultValue: "mailto:hardware.partybr@gmail.com" },
        { key: "mapsLink", label: "Google Maps", selector: "a[data-translate='maps_btn']", attr: "href", defaultValue: "https://www.google.com/maps/search/?api=1&query=Rua+Bartolomeu+Zunega,+151,+Pinheiros,+Sao+Paulo" },
        { key: "mapEmbedPreview", label: "Preview mapa (iframe)", selector: "#map-preview-iframe", attr: "data-src", defaultValue: "https://www.google.com/maps?q=Rua+Bartolomeu+Zunega,+151,+Pinheiros,+Sao+Paulo&output=embed" },
        { key: "wazeLink", label: "Waze", selector: "a[data-translate='waze_btn']", attr: "href", defaultValue: "https://waze.com/ul?q=Rua%20Bartolomeu%20Zunega%2C%20151%2C%20Pinheiros%2C%20Sao%20Paulo" },
        { key: "referenceLink", label: "Referencias dress code", selector: "a[data-translate='tool_reference_btn']", attr: "href", defaultValue: "https://instagram.com/hard.wareparty" },
        { key: "reminderWhatsApp", label: "Reminder WhatsApp", selector: "a[data-translate='reminder_whatsapp_btn']", attr: "href", defaultValue: "https://wa.me/5511916117340?text=Quero%20receber%20lembrete%20da%20HARDWARE%20Pocket%20Edition." },
        { key: "reminderTelegram", label: "Reminder Telegram", selector: "a[data-translate='reminder_telegram_btn']", attr: "href", defaultValue: "https://t.me/share/url?url=https://www.instagram.com/hard.wareparty/&text=Me%20lembre%20da%20HARDWARE%20Pocket%20Edition" },
        { key: "venueProposalLink", label: "Propor espaco", selector: "a[data-translate='venue_btn']", attr: "href", defaultValue: "mailto:hardware.partybr@gmail.com?subject=PROPOSTA%20DE%20LOCAL%20-%20[NOME%20DO%20ESPACO]" },
        { key: "partnerProposalLink", label: "Proposta de parceria", selector: "a[data-translate='partner_btn']", attr: "href", defaultValue: "mailto:hardware.partybr@gmail.com?subject=PROPOSTA%20DE%20PARCERIA%20-%20[MARCA/SERVICO]" },
        { key: "newsletterAction", label: "Destino newsletter", selector: ".newsletter-form", attr: "action", defaultValue: "https://formspree.io/f/mvzkzaav" },
        { key: "exitModalLink", label: "Link popup saida", selector: "#exit-modal a[data-translate='exit_btn']", attr: "href", defaultValue: "https://chat.whatsapp.com/C6zI7dtX37H7d6lMpqUOi8" },
        { key: "soundcloudPlaylist", label: "Playlist SoundCloud (URL)", selector: "#sc-widget", attr: "data-src", transform: "soundcloudPlaylist", defaultValue: "https://soundcloud.com/hardskullmusic/sets/hardware" },
        { key: "partnerLink1", label: "Parceiro 1 link", selector: "#partner-link-1", attr: "href", defaultValue: "https://www.instagram.com/infinityfusionofc/" },
        { key: "partnerLink2", label: "Parceiro 2 link", selector: "#partner-link-2", attr: "href", defaultValue: "https://www.instagram.com/thenexusbrasil/" },
        { key: "partnerLink3", label: "Parceiro 3 link", selector: "#partner-link-3", attr: "href", defaultValue: "https://www.instagram.com/hard_federal/" },
        { key: "partnerLink4", label: "Parceiro 4 link", selector: "#partner-link-4", attr: "href", defaultValue: "https://www.instagram.com/sky_nasushibar/" }
    ];

    const media = [];
    const toggles = [
        { key: "showTicketButton", label: "Exibir botao ingresso", selector: "#action-ticket", defaultValue: true },
        { key: "showGroupButton", label: "Exibir botao grupo", selector: "#action-group", defaultValue: true },
        { key: "showProducerButton", label: "Exibir botao produtor", selector: "#action-producer", defaultValue: true },
        { key: "showDjCtaButton", label: "Exibir CTA DJs", selector: "#action-demo", defaultValue: true },
        { key: "showCountdown", label: "Exibir contador", selector: "#countdown-wrap", defaultValue: true },
        { key: "showScheduleSection", label: "Exibir secao timetable", selector: "#dj-schedule-section", defaultValue: true },
        { key: "showSubgenresSection", label: "Exibir secao subvertentes", selector: "#subgenres-section", defaultValue: true },
        { key: "showNightPhasesSection", label: "Exibir secao fases da noite", selector: "#night-phases-section", defaultValue: true },
        { key: "showLineupSection", label: "Exibir secao line-up DJs", selector: "#lineup-section", defaultValue: false },
        { key: "showConceptSection", label: "Exibir secao conceito", selector: "#concept-section", defaultValue: true },
        { key: "showLocationSection", label: "Exibir secao local", selector: "#location-section", defaultValue: true },
        { key: "showGuideSection", label: "Exibir secao guia rapido", selector: "#guide-section", defaultValue: true },
        { key: "showRouteCard", label: "Exibir card como chegar", selector: "#tool-route-card", defaultValue: true },
        { key: "showFaqCard", label: "Exibir secao FAQ", selector: "#faq-section", defaultValue: true },
        { key: "showSafeSpaceSection", label: "Exibir secao informacoes finais", selector: "#safe-space-section", defaultValue: true },
        { key: "showJoinSection", label: "Exibir secao join", selector: "#join-section", defaultValue: true },
        { key: "showSupportProposalSection", label: "Exibir secao apoio", selector: "#support-proposal-section", defaultValue: true },
        { key: "showPartnersSection", label: "Exibir secao parceiros", selector: "#partners-section", defaultValue: true }
    ];

    djDefaults.forEach(function (dj, index) {
        const n = index + 1;

        fields.push(
            { key: "dj" + n + "Badge", label: "DJ #" + n + " badge", selector: "#dj" + n + "-badge", mode: "text", defaultValue: dj.badge },
            { key: "dj" + n + "Name", label: "DJ #" + n + " nome", selector: "#dj" + n + "-name", mode: "text", defaultValue: dj.name },
            { key: "dj" + n + "Style", label: "DJ #" + n + " vertente", selector: "#dj" + n + "-style", mode: "text", defaultValue: dj.style },
            { key: "dj" + n + "Region", label: "DJ #" + n + " regiao", selector: "#dj" + n + "-region", mode: "text", defaultValue: dj.region },
            { key: "dj" + n + "Description", label: "DJ #" + n + " descricao curta", selector: "#dj" + n + "-description", mode: "text", defaultValue: dj.description },
            { key: "dj" + n + "LogoFallback", label: "DJ #" + n + " fallback logo", selector: "#dj" + n + "-logo-fallback", mode: "text", defaultValue: dj.logoFallback },
            { key: "scheduleDj" + n + "Time", label: "Horario DJ #" + n, selector: "#schedule-dj" + n + "-time", mode: "text", defaultValue: scheduleDefaults[index].time },
            { key: "scheduleDj" + n + "Name", label: "Nome horario DJ #" + n, selector: "#schedule-dj" + n + "-name", mode: "text", defaultValue: scheduleDefaults[index].name }
        );

        media.push(
            {
                key: "dj" + n + "Photo",
                label: "DJ #" + n + " foto",
                selector: "#dj" + n + "-photo",
                attr: "src",
                altSelector: "#dj" + n + "-photo",
                altAttr: "alt",
                defaultValue: dj.photo,
                defaultAlt: dj.photoAlt,
                help: "Use URL publica, caminho local (assets/...) ou upload de arquivo."
            },
            {
                key: "dj" + n + "Logo",
                label: "DJ #" + n + " logo",
                selector: "#dj" + n + "-logo",
                attr: "src",
                altSelector: "#dj" + n + "-logo",
                altAttr: "alt",
                defaultValue: dj.logo,
                defaultAlt: dj.logoAlt,
                help: "Logo horizontal em PNG/SVG recomendado."
            }
        );

        toggles.push({
            key: "showDjCard" + n,
            label: "Exibir card DJ #" + n,
            selector: "#dj-card-" + n,
            defaultValue: false
        });
    });

    window.HARDWARE_SITE_CONFIG = {
        storageKeys: {
            overrides: "hardwareSiteOverrides.v1",
            adminCreds: "hardwareAdminCredentials.v1",
            adminSession: "hardwareAdminSession.v1"
        },
        api: {
            overridesPath: "/api/overrides",
            uploadPath: "/api/upload",
            authBase: "/api/auth"
        },
        admin: {
            routePath: "/cyber/"
        },
        event: {
            defaultDateIso: "2026-04-10T20:00:00-03:00"
        },
        editable: {
            meta: [
                {
                    key: "eventDateIso",
                    label: "Data do evento (ISO)",
                    help: "Formato recomendado: 2026-04-10T20:00:00-03:00",
                    defaultValue: "2026-04-10T20:00:00-03:00"
                }
            ],
            toggles: toggles,
            fields: fields,
            links: links,
            media: media,
            translations: {
                pt: [
                    { key: "date", label: "Data no hero", defaultValue: "10 DE ABRIL - 20H -> 05H" },
                    { key: "buy", label: "Botao comprar ingresso", defaultValue: "COMPRAR INGRESSO" },
                    { key: "group", label: "Botao grupo oficial", defaultValue: "GRUPO OFICIAL" },
                    { key: "producer", label: "Botao produtor", defaultValue: "FALAR COM PRODUTOR" },
                    { key: "demo", label: "CTA artista (HTML)", defaultValue: "<strong class='artist-cta-title'>Quer tocar na Hardware?</strong><small class='artist-cta-sub'>Envie seu Set</small>", mode: "html" },
                    { key: "demo_note", label: "Nota CTA artista", defaultValue: "Selecao aberta para DJs e produtores de hardtechno." },
                    { key: "social_title", label: "Titulo canais", defaultValue: "CANAIS OFICIAIS" },
                    { key: "social_text", label: "Texto canais", defaultValue: "Acompanhe novidades e fale com o time da festa." },
                    { key: "lineup_title", label: "Titulo subvertentes", defaultValue: "CONHECA MAIS SOBRE O HARDTECHNO" },
                    { key: "lineup_cards_title", label: "Titulo line up DJs", defaultValue: "LINE UP DJS" },
                    { key: "lineup_residents", label: "Subtitulo subvertentes", defaultValue: "ENTENDA COMO CADA VERTENTE MUDA A PISTA" },
                    { key: "lineup_soon", label: "Descricao subvertentes", defaultValue: "Explore as principais frentes do hardtechno e veja como textura, velocidade, pressao e groove transformam a experiencia da noite." },
                    { key: "lineup_hint", label: "Dica subvertentes", defaultValue: "Deslize nas abas para descobrir o que muda na sensacao de pista em cada vertente." },
                    { key: "lineup_card_swipe", label: "Dica arraste cards DJs", defaultValue: "Arraste os cards de DJ para o lado e veja o proximo artista." },
                    { key: "genre_neo_rave", label: "Genero Neo Rave", defaultValue: "NEO RAVE" },
                    { key: "genre_industrial", label: "Genero Industrial", defaultValue: "INDUSTRIAL" },
                    { key: "genre_hardtechno", label: "Genero Hardtechno", defaultValue: "HARDTECHNO" },
                    { key: "genre_acid", label: "Genero Acid Techno", defaultValue: "ACID TECHNO" },
                    { key: "genre_hardgroove", label: "Genero Hard Groove", defaultValue: "HARD GROOVE" },
                    { key: "genre_schranz", label: "Genero Schranz", defaultValue: "SCHRANZ" },
                    { key: "genre_raw", label: "Genero Raw Groove", defaultValue: "RAW GROOVE" },
                    { key: "genre_desc_neo_rave", label: "Descricao Neo Rave", defaultValue: "O hardtechno atual combina velocidade, peso, repeticao, tensao fisica e impacto direto no corpo. Aqui comeca um guia rapido para entender como cada vertente altera o clima da pista HARDWARE." },
                    { key: "genre_desc_industrial", label: "Descricao Industrial", defaultValue: "Texturas metalicas, kick seco e atmosfera mecanica para uma pressao sonora constante." },
                    { key: "genre_desc_hardtechno", label: "Descricao Hardtechno", defaultValue: "BPM elevado, linhas agressivas e drive continuo para manter a pista em pico de intensidade." },
                    { key: "genre_desc_acid", label: "Descricao Acid", defaultValue: "303 pulsante, camadas hipnoticas e acidez crescente para transicoes de alta tensao." },
                    { key: "genre_desc_hardgroove", label: "Descricao Hard Groove", defaultValue: "Groove percussivo e swing de bateria inspirado na escola 90s de Ben Sims e loops funkados de pista." },
                    { key: "genre_desc_schranz", label: "Descricao Schranz", defaultValue: "Hard techno alema de pegada mais seca e repetitiva, com enfoque percussivo, industrial e alto impacto ritmico." },
                    { key: "genre_desc_raw", label: "Descricao Raw Groove", defaultValue: "Ritmica crua, groove sujo e abordagem underground para quem curte peso sem filtro." },
                    { key: "concept_title", label: "Titulo conceito", defaultValue: "HARDWARE POCKET EDITION" },
                    { key: "concept_text", label: "Texto conceito 1", defaultValue: "A HARDWARE esta de volta em uma edicao pocket. Em parceria inedita com SKY-NA SUSHI CLUB, conectamos a cena underground a energia da pista brasileira." },
                    { key: "concept_extra", label: "Texto conceito 2", defaultValue: "A proposta e uma experiencia industrial, crua e intensa para quem vive o hardtechno em sua forma mais pura. A noite acontece das 20h as 05h, atravessando a madrugada." },
                    { key: "concept_vip", label: "Texto VIP (HTML)", defaultValue: "<strong>LISTA VIP:</strong> valida ate 23h. Com nome na lista apos 23h: R$ 30. Sem nome na lista: R$ 50. Evento 18+ com documento com foto. Retire seu ingresso no link da bio.", mode: "html" },
                    { key: "tools_title", label: "Titulo guia", defaultValue: "GUIA RAPIDO DA NOITE" },
                    { key: "tool_route_title", label: "Titulo como chegar", defaultValue: "COMO CHEGAR" },
                    { key: "tool_route_text", label: "Texto como chegar", defaultValue: "Chegue com antecedencia para validar lista VIP e entrar sem correria." },
                    { key: "tool_dress_title", label: "Titulo dress code", defaultValue: "DRESS CODE E VIBE" },
                    { key: "tool_dress_text", label: "Texto dress code", defaultValue: "Estetica industrial e urbana: preto, metalico, couro e atitude underground." },
                    { key: "tool_faq_title", label: "Titulo FAQ", defaultValue: "DUVIDAS FREQUENTES" },
                    { key: "faq_1", label: "FAQ 1", defaultValue: "Lista VIP valida ate 23h." },
                    { key: "faq_2", label: "FAQ 2", defaultValue: "Evento para maiores de 18 anos com documento." },
                    { key: "faq_3", label: "FAQ 3", defaultValue: "Ingressos no link oficial da festa." },
                    { key: "tool_reminder_title", label: "Titulo reminder", defaultValue: "ADICIONE NO CALENDARIO" },
                    { key: "tool_reminder_text", label: "Texto reminder", defaultValue: "Salve a data no celular para chegar com horario, lista VIP e endereco organizados." },
                    { key: "timeline_title", label: "Titulo timeline", defaultValue: "RITMO DA NOITE" },
                    { key: "timeline_20", label: "Timeline 20h", defaultValue: "20H WARM-UP" },
                    { key: "timeline_23", label: "Timeline 23h", defaultValue: "23H LISTA VIP ENCERRA" },
                    { key: "timeline_02", label: "Timeline 02h", defaultValue: "02H PICO DE PISTA" },
                    { key: "timeline_05", label: "Timeline 05h", defaultValue: "05H ENCERRAMENTO" },
                    { key: "location_header", label: "Cabecalho local", defaultValue: "CLASSIFIED LOCATION DATA" },
                    { key: "target_label", label: "Linha target", defaultValue: "TARGET: BAIRRO PINHEIROS" },
                    { key: "location_name", label: "Linha local", defaultValue: "LOCAL: SKY-NA SUSHI CLUB" },
                    { key: "access_label", label: "Label acesso", defaultValue: "ACESSO:" },
                    { key: "age_warning", label: "Aviso idade", defaultValue: "18+ COM DOCUMENTO COM FOTO" },
                    { key: "location_info", label: "Endereco", defaultValue: "RUA BARTOLOMEU ZUNEGA, 151 - PINHEIROS" },
                    { key: "safe_title", label: "Titulo safe space", defaultValue: "SAFE SPACE POLICY" },
                    { key: "safe_text", label: "Texto safe space", defaultValue: "Zero tolerancia para assedio, racismo, homofobia ou transfobia. Se voce vir algo, avise nossa equipe imediatamente. Respeite a pista." },
                    { key: "join_title", label: "Titulo join", defaultValue: "JOIN THE SYSTEM" },
                    { key: "venue_title", label: "Titulo venue", defaultValue: "GOSTARIA DO NOSSO EVENTO NO SEU ESPACO?" },
                    { key: "venue_text", label: "Texto venue", defaultValue: "Estamos mapeando novos territorios." },
                    { key: "venue_btn", label: "Botao venue", defaultValue: "PROPOR ESPACO" },
                    { key: "partner_btn", label: "Botao parceria", defaultValue: "CADASTRAR PROPOSTA" },
                    { key: "support", label: "Titulo apoio", defaultValue: "APOIO" },
                    { key: "newsletter", label: "Titulo newsletter", defaultValue: "CADASTRE-SE PARA NOVIDADES" },
                    { key: "newsletter_success", label: "Mensagem newsletter", defaultValue: "CADASTRO REALIZADO COM SUCESSO" },
                    { key: "cookie_text", label: "Texto cookies", defaultValue: "NOS USAMOS COOKIES PARA MELHORAR SUA EXPERIENCIA NO SISTEMA." },
                    { key: "cookie_accept", label: "Botao cookies", defaultValue: "ACEITAR" },
                    { key: "exit_wait", label: "Titulo popup saida", defaultValue: "ESPERE!" },
                    { key: "exit_text", label: "Texto popup saida", defaultValue: "Entre no grupo oficial e garanta acesso antecipado aos ingressos." },
                    { key: "exit_btn", label: "Botao popup saida", defaultValue: "ENTRAR NO GRUPO" }
                ]
            }
        }
    };
}());


