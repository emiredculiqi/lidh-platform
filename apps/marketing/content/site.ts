export type SiteContent = {
  nav: {
    benefits: string;
    demo: string;
    useCases: string;
    about: string;
    contact: string;
    bookCall: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    poweredBy: string;
    primaryCta: string;
    secondaryCta: string;
    badges: string[];
    leadCard: {
      label: string;
      timestamp: string;
      contact: string;
      detail: string;
    };
  };
  benefits: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: { title: string; body: string }[];
  };
  demo: {
    eyebrow: string;
    title: string;
    subtitle: string;
    intro: string;
    fields: {
      firstName: string;
      lastName: string;
      company: string;
      email: string;
      phone: string;
      websiteUrl: string;
      websiteUrlPlaceholder: string;
    };
    consent: string;
    submit: string;
    preparing: string;
    preparingHint: string;
    chatTitle: string;
    chatSubtitle: string;
    welcome: string;
    placeholder: string;
    send: string;
    promptsLeft: string;
    promptsLeftSingular: string;
    limitReachedTitle: string;
    limitReachedBody: string;
    limitReachedFeatures: string[];
    limitReachedCta: string;
    alreadyUsedTitle: string;
    alreadyUsedBody: string;
    manualPrep: {
      title: string;
      body: string;
    };
    errors: {
      required: string;
      emailInvalid: string;
      urlInvalid: string;
      crawlFailed: string;
      botProtected: string;
      rateLimited: string;
      generic: string;
      summary: string;
    };
  };
  useCases: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  about: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    bullets: string[];
  };
  contact: {
    eyebrow: string;
    title: string;
    subtitle: string;
    fields: {
      name: string;
      email: string;
      phone: string;
      business: string;
      message: string;
      preferredTime: string;
    };
    submit: string;
    sending: string;
    success: string;
    error: string;
    consent: string;
    errors: {
      required: string;
      nameMin: string;
      emailInvalid: string;
      summary: string;
    };
  };
  footer: {
    tagline: string;
    rights: string;
  };
  chat: {
    bubbleLabel: string;
    teaser: string;
    title: string;
    subtitle: string;
    welcome: string;
    placeholder: string;
    send: string;
    online: string;
    leadCaptured: string;
    humanHandoff: string;
    error: string;
    poweredBy: string;
  };
};

export const siteContent: { al: SiteContent; en: SiteContent } = {
  al: {
    nav: {
      benefits: "Përfitimet",
      demo: "Provo",
      useCases: "Industritë",
      about: "Rreth nesh",
      contact: "Kontakt",
      bookCall: "Cakto takim",
    },
    hero: {
      eyebrow: "Shërbim më i mirë, menaxhim më i lehtë",
      title: "Lidh biznesin tënd me klientët,",
      titleAccent: "24/7, mos humbisni më",
      subtitle:
        "Lidh.al ofron mbështetje 24/7 në shumë gjuhë për klientët e bizneseve shqiptare dhe kthen çdo bisedë në një mundësi për një klient të ri — integrohet thjesht në Website-in tuaj dhe WhatsApp.",
      poweredBy: "Mbështetur nga IA",
      primaryCta: "Cakto një takim",
      secondaryCta: "Shiko si funksionon",
      badges: ["Website", "WhatsApp"],
      leadCard: {
        label: "Klient i ri i regjistruar",
        timestamp: "tani",
        contact: "Erjon K. · +355 69 123 4567",
        detail: "erjon@example.com · kërkon takim nesër në 09:30",
      },
    },
    benefits: {
      eyebrow: "Pse Lidh.al",
      title: "Nuk humbisni më mundësi për klientë potencialë. Çdo kërkesë menaxhohet lehtë në një platformë të vetme.",
      subtitle:
        "Ne ndërtojmë asistentin digjital të biznesit tënd nga website-i juaj dhe dokumentet e siguruara nga ju. Duke u mbështetur në Inteligjencën Artificiale (IA) dhe bashkë me informacionet e siguruara nga ju, klientët tuaj marrin shërbimin që u nevojitet.",
      items: [
        {
          title: "Mbështetje 24/7 në çdo gjuhë",
          body:
            "Klientët marrin përgjigje në sekonda — në shqip, anglisht, italisht ose çfarëdo gjuhe — pa pritur orarin e zyrës.",
        },
        {
          title: "Klientët gjejnë informacionin shpejt",
          body:
            "Shpesh ndodh që vizitorët në website-in tuaj nuk orientohen për të gjetur informacionin që kërkojnë në ndërfaqet e ndryshme. Kjo zgjidhet nëpërmjet pyetjeve direkte që mund t'i drejtohen agjentit digjital në website-in tuaj, duke ia kthyer përgjigjen brenda sekondash.",
        },
        {
          title: "Çdo bisedë kthehet në mundësi",
          body:
            "Informacionet e klientit mblidhen bashkë me kontekstin e bisedës, që ekipi yt të dijë saktë çfarë t'i ofrojë.",
        },
        {
          title: "Integrohet kudo që je",
          body:
            "Integrohet dhe funksionon në website-in aktual në WordPress, React/Next.js dhe rrjete sociale si WhatsApp — pa rindërtuar asgjë, brenda ditës.",
        },
        {
          title: "Panel i thjeshtë për menaxhimin e klientëve të biznesit",
          body:
            "Sheh të gjitha bisedat dhe mundësitë në një panel të vetëm — i qartë, i kërkueshëm dhe gati për ekipin e shitjeve.",
        },
      ],
    },
    demo: {
      eyebrow: "Provo në website-in tënd",
      title: "Provo si do të dukej asistenti yt — me website-in tënd, tani.",
      subtitle:
        "Plotëso të dhënat, jep adresën e website-it tënd dhe ne ndërtojmë një asistent që njeh përmbajtjen e website tënd. Më pas mund t'i bësh deri në 3 pyetje për të provuar eksperiencën.",
      intro: "3 pyetje falas — pa instalim, pa kod.",
      fields: {
        firstName: "Emri",
        lastName: "Mbiemri",
        company: "Emri i biznesit",
        email: "Email",
        phone: "Numri i telefonit",
        websiteUrl: "Adresa e website-it",
        websiteUrlPlaceholder: "p.sh. shembull.al",
      },
      consent:
        "Duke vazhduar, pranon që Lidh.al të ruajë të dhënat e tua, të lexojë faqen tënde publike për të ndërtuar demon, dhe të të dërgojë me email një përmbledhje të kësaj bisede.",
      submit: "Ndërto demon time",
      preparing: "Po ndërtojmë asistentin tënd…",
      preparingHint:
        "Po lexojmë website-in tënd dhe po e bëjmë gati. Mund të zgjasë pak sekonda.",
      chatTitle: "Asistenti yt demo",
      chatSubtitle: "Mbështetur tek website-i yt",
      welcome:
        "Përshëndetje! 👋 Jam asistenti i {company}. Më pyet çfarëdo që një klient yt mund të pyeste — orare, shërbime, çmime, kontakt — dhe do t'i përgjigjem në sekonda.",
      placeholder: "Shkruaj pyetjen tënde…",
      send: "Dërgo",
      promptsLeft: "Të kanë mbetur {n} pyetje",
      promptsLeftSingular: "Të ka mbetur 1 pyetje",
      limitReachedTitle: "Faleminderit që e provove!",
      limitReachedBody:
        "Ky ishte vetëm një fillim i shpejtë. Versioni real i Lidh.al të jep:",
      limitReachedFeatures: [
        "Pyetje pa kufi nga klientët, 24 orë në ditë",
        "Lexon dokumentet, FAQ-të dhe materialet e brendshme të biznesit",
        "Integrohet me website-in dhe WhatsApp",
        "Kap çdo mundësi automatikisht dhe e dërgon te ekipi yt",
      ],
      limitReachedCta: "Cakto një takim",
      alreadyUsedTitle: "E ke provuar tashmë demon",
      alreadyUsedBody:
        "Çdo email mund të provojë demon vetëm një herë. Për të parë versionin e plotë të asistentit, cakto një takim me ekipin tonë.",
      manualPrep: {
        title: "Demoja jote po përgatitet me kujdes ✨",
        body:
          "Kërkesa juaj për demo të agjentit digjital u mor. Stafi ynë do ju kontaktojë kur demoja për biznesin tënd të jetë gati për t'u provuar nga ju. Faleminderit!",
      },
      errors: {
        required: "Kjo fushë është e detyrueshme.",
        emailInvalid: "Ju lutem shkruani një email të vlefshëm.",
        urlInvalid: "Adresa e website-it nuk është e vlefshme.",
        crawlFailed:
          "Nuk mundëm të lexojmë këtë website. Provo një adresë tjetër ose na shkruaj në info@lidh.al.",
        botProtected:
          "Për këtë lloj website-i na duhet të organizojmë një takim për të bërë demon, pasi duhet të përgatitet në një kohë më të gjatë. Lër një takim tani.",
        rateLimited:
          "Po marrim shumë kërkesa nga ti. Provo përsëri më vonë.",
        generic: "Diçka shkoi keq. Provo përsëri.",
        summary: "Ju lutem plotësoni fushat e detyrueshme.",
      },
    },
    useCases: {
      eyebrow: "Industritë që mbështesim",
      title: "I ndërtuar për bizneset shqiptare",
      subtitle:
        "Çdo biznes ka klientë me pyetje të përsëritura dhe jo vetëm. Ne i përgjigjemi në çdo moment, duke i dhënë klientit tuaj atë që dëshiron të mësojë më shumë rreth jush.",
    },
    about: {
      eyebrow: "Rreth nesh",
      title: "Si lindi ideja e Lidh.al?",
      paragraphs: [
        "Lidh.al lindi me një ide të thjeshtë: bizneset shqiptare meritojnë mjete moderne për të komunikuar me klientët, pa investime të mëdha dhe pa kompleksitet.",
        "Ne marrim website-in dhe materialet e biznesit tënd, ndërtojmë një asistent që njeh produktet dhe shërbimet e tua, dhe e lidhim atje ku klientët të kërkojnë — në website-in ekzistues dhe WhatsApp.",
      ],
      bullets: [
        "Implementim i shpejtë, pa kontrata afatgjata",
        "Mbështetje në shqip nga ekipi ynë",
        "Të dhënat e klientëve mbeten të tuat",
      ],
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Le të flasim për biznesin tënd.",
      subtitle:
        "Lër një kërkesë për takim ose pyetje — të kthejmë përgjigje brenda 24 orëve.",
      fields: {
        name: "Emri i plotë",
        email: "Email",
        phone: "Numri i telefonit",
        business: "Emri i biznesit",
        message: "Si mund të të ndihmojmë?",
        preferredTime: "Ora e preferuar për takim (opsionale)",
      },
      submit: "Dërgo kërkesën",
      sending: "Po dërgohet…",
      success: "Faleminderit! Do të të kontaktojmë së shpejti.",
      error: "Diçka shkoi keq. Provo përsëri ose na shkruaj në info@lidh.al.",
      consent:
        "Duke dërguar këtë formë, pranon që Lidh.al të të kontaktojë në lidhje me kërkesën tënde.",
      errors: {
        required: "Kjo fushë është e detyrueshme.",
        nameMin: "Emri duhet të ketë të paktën 2 shkronja.",
        emailInvalid: "Ju lutem shkruani një email të vlefshëm.",
        summary: "Ju lutem plotësoni fushat e detyrueshme.",
      },
    },
    footer: {
      tagline: "Shërbim më i mirë, menaxhim më i lehtë",
      rights: "Të gjitha të drejtat e rezervuara.",
    },
    chat: {
      bubbleLabel: "Bisedo me ne",
      teaser: "Pyetje? Bisedo me ne 👋",
      title: "Asistenti i Lidh.al",
      subtitle: "Online tani — përgjigjemi në sekonda",
      welcome:
        "Përshëndetje! Si mund të të ndihmoj? Më pyet për shërbimet, integrimin, ose le një kontakt që ekipi të të kthejë përgjigje.",
      placeholder: "Shkruaj mesazhin tënd…",
      send: "Dërgo",
      online: "Online",
      leadCaptured:
        "Faleminderit! Të dhënat e tua i kemi marrë — do të të kontaktojmë së shpejti.",
      humanHandoff:
        "Dikush nga ekipi do të të kthejë përgjigje shumë shpejt — me email ose WhatsApp.",
      error:
        "Diçka shkoi keq. Provo përsëri ose na shkruaj në info@lidh.al.",
      poweredBy: "Mbështetur nga IA",
    },
  },
  en: {
    nav: {
      benefits: "Benefits",
      demo: "Try it",
      useCases: "Industries",
      about: "About",
      contact: "Contact",
      bookCall: "Book a call",
    },
    hero: {
      eyebrow: "Better service & smarter management",
      title: "Connect your business with customers,",
      titleAccent: "24/7, never miss another one.",
      subtitle:
        "Lidh.al gives Albanian businesses 24/7 multilingual customer support and turns every conversation into a new-customer opportunity — easily integrated into your website and WhatsApp.",
      poweredBy: "Powered by AI",
      primaryCta: "Book a meeting",
      secondaryCta: "See how it works",
      badges: ["Website", "WhatsApp"],
      leadCard: {
        label: "New lead captured",
        timestamp: "just now",
        contact: "Erjon K. · +355 69 123 4567",
        detail: "erjon@example.com · wants 09:30 appointment tomorrow",
      },
    },
    benefits: {
      eyebrow: "Why Lidh.al",
      title:
        "Never miss a customer opportunity again. Every request handled in one simple platform.",
      subtitle:
        "We build your business's digital assistant from your website and the documents you share. Powered by Artificial Intelligence (AI) together with the information you provide, your customers get exactly the service they need.",
      items: [
        {
          title: "24/7 support in any language",
          body:
            "Customers get answers in seconds — in Albanian, English, Italian or any language — no waiting for office hours.",
        },
        {
          title: "Customers find answers instantly",
          body:
            "Instead of digging through your website, customers ask the agent directly and get the answer in seconds.",
        },
        {
          title: "Every conversation becomes an opportunity",
          body:
            "Customer details are captured along with the context of the conversation, so your team knows exactly what to offer next.",
        },
        {
          title: "Plugs in wherever you are",
          body:
            "Integrates and runs on your existing WordPress or React/Next.js website and social channels like WhatsApp — no rebuild required, live within a day.",
        },
        {
          title: "A simple panel to manage your customers",
          body:
            "See every conversation and opportunity in one clean panel — clear, searchable and ready for your sales team.",
        },
      ],
    },
    demo: {
      eyebrow: "Try it on your website",
      title: "Try how your assistant would look — with your own site, right now.",
      subtitle:
        "Fill in your details, give us your website URL, and we'll build an assistant that knows your content. Then you can ask up to 3 questions to feel the experience.",
      intro: "3 free questions — no setup, no code.",
      fields: {
        firstName: "First name",
        lastName: "Last name",
        company: "Business name",
        email: "Email",
        phone: "Phone number",
        websiteUrl: "Website URL",
        websiteUrlPlaceholder: "e.g. yourbusiness.com",
      },
      consent:
        "By continuing, you agree that Lidh.al may store your details, read your public website to build the demo, and email you a summary of this conversation.",
      submit: "Build my demo",
      preparing: "Building your assistant…",
      preparingHint:
        "Reading your website and getting it ready. This takes a few seconds.",
      chatTitle: "Your demo assistant",
      chatSubtitle: "Based on your website",
      welcome:
        "Hi! 👋 I'm {company}'s assistant. Ask me anything one of your customers might ask — hours, services, pricing, contact — and I'll reply in seconds.",
      placeholder: "Type your question…",
      send: "Send",
      promptsLeft: "{n} questions left",
      promptsLeftSingular: "1 question left",
      limitReachedTitle: "Thanks for trying it!",
      limitReachedBody:
        "That was just a quick taste. The full Lidh.al version gives you:",
      limitReachedFeatures: [
        "Unlimited customer questions, 24/7",
        "Reads your business documents, FAQs and internal materials",
        "Integrates with your website and WhatsApp",
        "Captures every lead automatically and sends them to your team",
      ],
      limitReachedCta: "Book a meeting",
      alreadyUsedTitle: "You've already tried the demo",
      alreadyUsedBody:
        "Each email can try the demo once. To see the full assistant in action, book a quick call with our team.",
      manualPrep: {
        title: "Your demo is being prepared with care ✨",
        body:
          "Your request for an AI assistant demo has been received. Our team will contact you once the demo for your business is ready for you to try. Thank you!",
      },
      errors: {
        required: "This field is required.",
        emailInvalid: "Please enter a valid email address.",
        urlInvalid: "That doesn't look like a valid website URL.",
        crawlFailed:
          "We couldn't read that website. Try a different URL or email us at info@lidh.al.",
        botProtected:
          "For this type of website we need to set up a meeting to build the demo, since it takes more time to prepare. Book a meeting now.",
        rateLimited:
          "Too many requests from your side — please try again later.",
        generic: "Something went wrong. Please try again.",
        summary: "Please fill in the required fields.",
      },
    },
    useCases: {
      eyebrow: "Industries we support",
      title: "Built for Albanian businesses",
      subtitle:
        "Every business has customers asking the same questions — and many more. We answer them at any moment, giving each customer exactly what they want to learn about you.",
    },
    about: {
      eyebrow: "About us",
      title: "How did the Lidh.al idea come about?",
      paragraphs: [
        "Lidh.al started with a simple idea: Albanian businesses deserve modern customer tools — without big upfront costs or complexity.",
        "We take your website and business materials, build an assistant that knows your products and services, and connect it wherever your customers reach out — your existing website and WhatsApp.",
      ],
      bullets: [
        "Fast onboarding, no long-term contracts",
        "Albanian-speaking support team",
        "Your customer data stays yours",
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: "Let's talk about your business.",
      subtitle:
        "Drop a meeting request or question — we'll reply within 24 hours.",
      fields: {
        name: "Full name",
        email: "Email",
        phone: "Phone number",
        business: "Business name",
        message: "How can we help?",
        preferredTime: "Preferred meeting time (optional)",
      },
      submit: "Send request",
      sending: "Sending…",
      success: "Thanks! We'll be in touch shortly.",
      error: "Something went wrong. Please try again or email info@lidh.al.",
      consent:
        "By submitting this form, you agree that Lidh.al may contact you regarding your request.",
      errors: {
        required: "This field is required.",
        nameMin: "Name must be at least 2 characters.",
        emailInvalid: "Please enter a valid email address.",
        summary: "Please fill in the required fields.",
      },
    },
    footer: {
      tagline: "BBetter service & smarter management.",
      rights: "All rights reserved.",
    },
    chat: {
      bubbleLabel: "Chat with us",
      teaser: "Have a question? Chat with us 👋",
      title: "Lidh.al Assistant",
      subtitle: "Online now — replies in seconds",
      welcome:
        "Hi! How can I help? Ask me about our services or integration, or leave your contact and the team will get back to you.",
      placeholder: "Type your message…",
      send: "Send",
      online: "Online",
      leadCaptured:
        "Thanks! We have your details — someone from the team will be in touch shortly.",
      humanHandoff:
        "Someone from the team will get back to you shortly — by email or WhatsApp.",
      error:
        "Something went wrong. Please try again or email info@lidh.al.",
      poweredBy: "Powered by AI",
    },
  },
};
