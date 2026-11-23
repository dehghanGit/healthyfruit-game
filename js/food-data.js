// اطلاعات غذاهای سالم و ناسالم برای بازی «نبرد سلامت»
// Health Battle Food Data Catalog

export const FOOD_DATABASE = {
    healthy: [
        {
            id: 'apple',
            toastLabelFa: 'فیبر مفید',
            toastDescriptionFa: 'سیب فیبر و ویتامین C دارد و به گوارش کمک می‌کند.',
            nameFa: 'سیب سرخ',
            categoryFa: 'میوه سرشار از فیبر',
            image: './assets/images/apple.png',
            color: '#e53935',
            splashColors: ['#e53935', '#ff5252', '#ff8a80', '#ffffff'],
            points: 1,
            benefitFa: 'فیبر سیب به گوارش کمک می\u200cکند و بخشی از یک رژیم متنوع و مفید برای قلب است.'
        },
        {
            id: 'banana',
            toastLabelFa: 'پتاسیم مفید',
            toastDescriptionFa: 'موز پتاسیم و ویتامین B6 دارد و به عملکرد عضلات کمک می‌کند.',
            nameFa: 'موز تازه',
            categoryFa: 'منبع غنی پتاسیم',
            image: './assets/images/banana.png',
            color: '#fbc02d',
            splashColors: ['#fbc02d', '#fff176', '#fffde7', '#fff8e1'],
            points: 1,
            benefitFa: 'پتاسیم موز به عملکرد عضلات و حفظ فشار خون طبیعی کمک می\u200cکند.'
        },
        {
            id: 'broccoli',
            toastLabelFa: 'ویتامین و فیبر',
            toastDescriptionFa: 'بروکلی ویتامین C و K و فیبر دارد.',
            nameFa: 'بروکلی ترد',
            categoryFa: 'سوپرفود سبز',
            image: './assets/images/broccoli.png',
            color: '#2e7d32',
            splashColors: ['#2e7d32', '#4caf50', '#81c784', '#c8e6c9'],
            points: 1,
            benefitFa: 'بروکلی فیبر و ویتامین دارد و به تنوع سبزیجات در رژیم غذایی کمک می\u200cکند.'
        },
        {
            id: 'carrot',
            toastLabelFa: 'بتاکاروتن مفید',
            toastDescriptionFa: 'هویج بتاکاروتن دارد که بدن آن را به ویتامین A برای بینایی تبدیل می‌کند.',
            nameFa: 'هویج نارنجی',
            categoryFa: 'سرشار از بتاکاروتن',
            image: './assets/images/carrot.png',
            color: '#fb8c00',
            splashColors: ['#fb8c00', '#ffa726', '#ffcc80', '#fff3e0'],
            points: 1,
            benefitFa: 'هویج بتاکاروتن دارد که بدن آن را به ویتامین A برای بینایی تبدیل می\u200cکند.'
        },
        {
            id: 'cucumber',
            toastLabelFa: 'آب فراوان',
            toastDescriptionFa: 'خیار آب زیادی دارد و به تأمین آب بدن کمک می‌کند.',
            nameFa: 'خیار سبز بوته‌ای',
            categoryFa: 'آبرسان طبیعی',
            image: './assets/images/cucumber.png',
            color: '#43a047',
            splashColors: ['#43a047', '#66bb6a', '#a5d6a7', '#e8f5e9'],
            points: 1,
            benefitFa: 'خیار سرشار از آب است و به دریافت آب و تنوع سبزیجات کمک می\u200cکند.'
        },
        {
            id: 'egg',
            toastLabelFa: 'پروتئین مفید',
            toastDescriptionFa: 'تخم‌مرغ پروتئین و کولین دارد و به ترمیم بافت‌ها کمک می‌کند.',
            nameFa: 'تخم‌مرغ محلی',
            categoryFa: 'پروتئین کامل',
            image: './assets/images/egg.png',
            color: '#f9a825',
            splashColors: ['#fbc02d', '#fff9c4', '#ffffff', '#fffde7'],
            points: 1,
            benefitFa: 'تخم\u200cمرغ پروتئین و کولین دارد و به ساخت و ترمیم بافت\u200cها کمک می\u200cکند.'
        },
        {
            id: 'fish',
            toastLabelFa: 'پروتئین مفید',
            toastDescriptionFa: 'ماهی پروتئین دارد؛ انواع چرب آن امگا ۳ مفید برای قلب دارند.',
            nameFa: 'ماهی تازه دریا',
            categoryFa: 'منبع امگا ۳',
            image: './assets/images/fish.png',
            color: '#0288d1',
            splashColors: ['#0288d1', '#4fc3f7', '#b3e5fc', '#ffffff'],
            points: 1,
            benefitFa: 'ماهی منبع پروتئین است؛ ماهی\u200cهای چرب امگا ۳ مفید برای سلامت قلب دارند.'
        },
        {
            id: 'lemon',
            toastLabelFa: 'ویتامین C',
            toastDescriptionFa: 'لیمو ویتامین C دارد و به جذب آهن گیاهی کمک می‌کند.',
            nameFa: 'لیموترش تازه',
            categoryFa: 'بمب ویتامین C',
            image: './assets/images/lemon.png',
            color: '#fbc02d',
            splashColors: ['#fbc02d', '#fff59d', '#fffde7', '#ffffff'],
            points: 1,
            benefitFa: 'ویتامین C لیمو به جذب آهن گیاهی و عملکرد طبیعی ایمنی کمک می\u200cکند.'
        },
        {
            id: 'milk',
            toastLabelFa: 'کلسیم مفید',
            toastDescriptionFa: 'شیر کم‌چرب کلسیم و پروتئین لازم برای استخوان‌ها دارد.',
            nameFa: 'شیر طبیعی کم‌چرب',
            categoryFa: 'کلسیم و سلامت استخوان',
            image: './assets/images/milk.png',
            color: '#e0f7fa',
            splashColors: ['#ffffff', '#e0f7fa', '#b2ebf2', '#f5f5f5'],
            points: 1,
            benefitFa: 'شیر کم\u200cچرب پروتئین و کلسیم لازم برای استخوان\u200cها را فراهم می\u200cکند.'
        },
        {
            id: 'orange',
            toastLabelFa: 'ویتامین C و فیبر',
            toastDescriptionFa: 'پرتقال ویتامین C و فیبر دارد و به عملکرد طبیعی ایمنی کمک می‌کند.',
            nameFa: 'پرتقال آبدار',
            categoryFa: 'سرشار از مرکبات حیاتی',
            image: './assets/images/orange.png',
            color: '#ff9800',
            splashColors: ['#ff9800', '#ffb74d', '#ffe0b2', '#ffffff'],
            points: 1,
            benefitFa: 'پرتقال کامل فیبر و ویتامین C دارد؛ میوه کامل انتخاب بهتری از نوشیدنی قندی است.'
        },
        {
            id: 'pineapple',
            toastLabelFa: 'ویتامین C',
            toastDescriptionFa: 'آناناس ویتامین C و فیبر دارد.',
            nameFa: 'آناناس طلایی',
            categoryFa: 'آنزیم بروملین ضدالتهاب',
            image: './assets/images/pineapple.png',
            color: '#fbc02d',
            splashColors: ['#fbc02d', '#ffd54f', '#ffecb3', '#fff8e1'],
            points: 1,
            benefitFa: 'آناناس فیبر و ویتامین C دارد و بخشی از یک رژیم متنوع است.'
        },
        {
            id: 'salad',
            toastLabelFa: 'فیبر فراوان',
            toastDescriptionFa: 'سالاد سبزیجات فیبر و ریزمغذی‌های متنوع دارد.',
            nameFa: 'سالاد سبزیجات معطر',
            categoryFa: 'فیبر و ریزمغذی‌ها',
            image: './assets/images/salad.png',
            color: '#388e3c',
            splashColors: ['#388e3c', '#66bb6a', '#a5d6a7', '#e8f5e9'],
            points: 1,
            benefitFa: 'سبزیجات متنوع سالاد فیبر و ریزمغذی\u200cها را با نمک و سس کمتر فراهم می\u200cکنند.'
        },
        {
            id: 'strawberry',
            toastLabelFa: 'ویتامین C و فیبر',
            toastDescriptionFa: 'توت‌فرنگی ویتامین C و فیبر دارد.',
            nameFa: 'توت‌فرنگی قرمز',
            categoryFa: 'پلی‌فنول محافظ قلب',
            image: './assets/images/strawberry.png',
            color: '#e91e63',
            splashColors: ['#e91e63', '#f06292', '#f8bbd0', '#ffffff'],
            points: 1,
            benefitFa: 'توت\u200cفرنگی فیبر و ویتامین C دارد و جایگزین مناسبی برای تنقلات قندی است.'
        },
        {
            id: 'tomato',
            toastLabelFa: 'لیکوپن مفید',
            toastDescriptionFa: 'گوجه‌فرنگی لیکوپن و ویتامین C دارد.',
            nameFa: 'گوجه‌فرنگی رسیده',
            categoryFa: 'لیکوپن معجزه‌آسا',
            image: './assets/images/tomato.png',
            color: '#d32f2f',
            splashColors: ['#d32f2f', '#ef5350', '#ff8a80', '#ffffff'],
            points: 1,
            benefitFa: 'گوجه\u200cفرنگی حاوی لیکوپن و ویتامین\u200cهاست و به تنوع سبزیجات کمک می\u200cکند.'
        },
        {
            id: 'watermelon',
            toastLabelFa: 'آب فراوان',
            toastDescriptionFa: 'هندوانه آب و مواد مغذی دارد و به تأمین آب بدن کمک می‌کند.',
            nameFa: 'هندوانه تابستانی',
            categoryFa: 'سیترولین و هیدراتاسیون',
            image: './assets/images/watermelon.png',
            color: '#e91e63',
            splashColors: ['#e91e63', '#4caf50', '#ff80ab', '#ffffff'],
            points: 1,
            benefitFa: 'هندوانه آب و مواد مغذی فراهم می\u200cکند؛ میوه کامل بخشی از تغذیه متعادل است.'
        },
        {
            "id": "pomegranate",
            "nameFa": "انار تازه",
            "toastLabelFa": "فیبر و آنتی‌اکسیدان",
            "toastDescriptionFa": "انار فیبر و ترکیبات آنتی‌اکسیدانی دارد؛ میوه کامل را به آبمیوه ترجیح بده.",
            "categoryFa": "فیبر و آنتی‌اکسیدان",
            "image": "./assets/images/pomegranate.png",
            "color": "#ba2542",
            "splashColors": [
                "#ba2542",
                "#fff1bc",
                "#ffffff"
            ],
            "points": 1,
            "benefitFa": "انار فیبر و ترکیبات آنتی‌اکسیدانی دارد؛ میوه کامل را به آبمیوه ترجیح بده."
        },
        {
            "id": "almond",
            "nameFa": "بادام خام بی‌نمک",
            "toastLabelFa": "چربی غیراشباع",
            "toastDescriptionFa": "بادام بی‌نمک فیبر، پروتئین و چربی غیراشباع دارد؛ در مقدار متعادل مصرف کن.",
            "categoryFa": "چربی غیراشباع",
            "image": "./assets/images/almond.png",
            "color": "#bc8448",
            "splashColors": [
                "#bc8448",
                "#fff1bc",
                "#ffffff"
            ],
            "points": 1,
            "benefitFa": "بادام بی‌نمک فیبر، پروتئین و چربی غیراشباع دارد؛ در مقدار متعادل مصرف کن."
        },
        {
            "id": "cheese",
            "nameFa": "پنیر کم‌نمک و کم‌چرب",
            "toastLabelFa": "کلسیم و پروتئین",
            "toastDescriptionFa": "پنیر کم‌نمک و کم‌چرب کلسیم و پروتئین دارد و به سلامت استخوان‌ها کمک می‌کند.",
            "categoryFa": "کلسیم و پروتئین",
            "image": "./assets/images/cheese.png",
            "color": "#edba3c",
            "splashColors": [
                "#edba3c",
                "#fff1bc",
                "#ffffff"
            ],
            "points": 1,
            "benefitFa": "پنیر کم‌نمک و کم‌چرب کلسیم و پروتئین دارد و به سلامت استخوان‌ها کمک می‌کند."
        },
        {
            "id": "walnut",
            "nameFa": "گردوی خام بی‌نمک",
            "toastLabelFa": "چربی غیراشباع",
            "toastDescriptionFa": "گردو چربی غیراشباع، فیبر و پروتئین گیاهی دارد؛ مقدار متعادل آن انتخاب مفیدی است.",
            "categoryFa": "چربی غیراشباع",
            "image": "./assets/images/walnut.png",
            "color": "#ad713e",
            "splashColors": [
                "#ad713e",
                "#fff1bc",
                "#ffffff"
            ],
            "points": 1,
            "benefitFa": "گردو چربی غیراشباع، فیبر و پروتئین گیاهی دارد؛ مقدار متعادل آن انتخاب مفیدی است."
        },
        {
            "id": "doogh",
            "nameFa": "دوغ کم‌نمک",
            "toastLabelFa": "کلسیم و پروتئین",
            "toastDescriptionFa": "دوغ کم‌نمک کلسیم و پروتئین دارد؛ نوع بدون نمک افزوده را ترجیح بده.",
            "categoryFa": "نوشیدنی لبنی کم‌نمک",
            "image": "./assets/images/doogh.png",
            "color": "#dbeaf1",
            "splashColors": [
                "#ffffff",
                "#dbeaf1",
                "#a4c7e0"
            ],
            "points": 1,
            "benefitFa": "دوغ کم‌نمک بخشی از گروه لبنیات است و کلسیم و پروتئین فراهم می‌کند."
        }
    ],

    unhealthy: [
        {
            id: 'burger',
            toastLabelFa: 'چربی و نمک زیاد',
            nameFa: 'همبرگر چرب و شور',
            categoryFa: 'فست‌فود پر از چربی ترانس',
            image: './assets/images/burger.png',
            color: '#8d6e63',
            splashColors: ['#5d4037', '#d32f2f', '#ff7043', '#212121'],
            harmFa: 'چربی اشباع زیاد می\u200cتواند کلسترول LDL و خطر بیماری قلبی را افزایش دهد.',
            risksFa: [{ title: 'بیماری قلبی', description: 'چربی اشباع زیاد می\u200cتواند کلسترول LDL و خطر بیماری قلبی را افزایش دهد.' }, { title: 'فشار خون بالا', description: 'نمک زیاد در همبرگر و سس می\u200cتواند فشار خون را بالا ببرد.' }, { title: 'افزایش وزن', description: 'وعده\u200cهای پرانرژی در صورت مصرف مکرر می\u200cتوانند به افزایش وزن کمک کنند.' }]
        },
        {
            id: 'fries',
            toastLabelFa: 'نمک زیاد',
            nameFa: 'سیب‌زمینی سرخ‌کرده صنعتی',
            categoryFa: 'روغن اکسیدشده و نمک بالا',
            image: './assets/images/fries.png',
            color: '#ffb300',
            splashColors: ['#b71c1c', '#ffb300', '#e65100', '#263238'],
            harmFa: 'نمک زیاد فشار خون را بالا می\u200cبرد و خطر بیماری قلبی را افزایش می\u200cدهد.',
            risksFa: [{ title: 'خطر حمله قلبی', description: 'نمک زیاد فشار خون را بالا می\u200cبرد و خطر بیماری قلبی را افزایش می\u200cدهد.' }, { title: 'فشار خون بالا', description: 'سیب\u200cزمینی سرخ\u200cکرده شور می\u200cتواند سدیم زیادی به رژیم غذایی اضافه کند.' }, { title: 'افزایش وزن', description: 'سرخ\u200cکردن انرژی غذا را زیاد می\u200cکند؛ مصرف مکرر به افزایش وزن کمک می\u200cکند.' }]
        },
        {
            id: 'soda',
            toastLabelFa: 'قند زیاد',
            nameFa: 'نوشابه گازدار قندی',
            categoryFa: 'شکر مایع و اسید فسفریک',
            image: './assets/images/soda.png',
            color: '#b71c1c',
            splashColors: ['#b71c1c', '#37474f', '#d32f2f', '#ff5252'],
            harmFa: 'مصرف مکرر نوشیدنی\u200cهای قندی می\u200cتواند به افزایش وزن و خطر دیابت نوع ۲ کمک کند.',
            risksFa: [{ title: 'دیابت نوع ۲', description: 'مصرف مکرر نوشیدنی\u200cهای قندی می\u200cتواند به افزایش وزن و خطر دیابت نوع ۲ کمک کند.' }, { title: 'افزایش وزن', description: 'نوشابه قند و انرژی زیادی دارد و احساس سیری کمی ایجاد می\u200cکند.' }, { title: 'پوسیدگی دندان', description: 'قند نوشابه به پوسیدگی دندان کمک می\u200cکند.' }]
        },
        {
            id: 'candy',
            toastLabelFa: 'قند زیاد',
            nameFa: 'آب‌نبات رنگی مصنوعی',
            categoryFa: 'قند ساده و رنگ شیمیایی',
            image: './assets/images/candy.png',
            color: '#ad1457',
            splashColors: ['#ad1457', '#d81b60', '#ab47bc', '#4a148c'],
            harmFa: 'مصرف زیاد و مکرر قند با افزایش وزن، خطر دیابت نوع ۲ را بالا می\u200cبرد.',
            risksFa: [{ title: 'دیابت نوع ۲', description: 'مصرف زیاد و مکرر قند با افزایش وزن، خطر دیابت نوع ۲ را بالا می\u200cبرد.' }, { title: 'پوسیدگی دندان', description: 'قند آب\u200cنبات به باکتری\u200cهای مولد پوسیدگی دندان غذا می\u200cرساند.' }, { title: 'افزایش وزن', description: 'آب\u200cنبات قند افزوده زیادی دارد و مواد مغذی کمی فراهم می\u200cکند.' }]
        },
        {
            id: 'pizza',
            toastLabelFa: 'نمک و چربی زیاد',
            nameFa: 'پیتزای سوسیس پرپنیر',
            categoryFa: 'پنیر چرب و گوشت فرآوری‌شده',
            image: './assets/images/pizza.png',
            color: '#d84315',
            splashColors: ['#d84315', '#f57c00', '#b71c1c', '#424242'],
            harmFa: 'پنیر، سس و گوشت فرآوری\u200cشده می\u200cتوانند نمک زیادی داشته باشند.',
            risksFa: [{ title: 'فشار خون بالا', description: 'پنیر، سس و گوشت فرآوری\u200cشده می\u200cتوانند نمک زیادی داشته باشند.' }, { title: 'بیماری قلبی', description: 'پنیر و گوشت چرب می\u200cتوانند دریافت چربی اشباع را بالا ببرند.' }, { title: 'افزایش وزن', description: 'مصرف مکرر وعده\u200cهای بزرگ و پرانرژی به افزایش وزن کمک می\u200cکند.' }]
        },
        {
            id: 'hotdog',
            toastLabelFa: 'نمک زیاد',
            nameFa: 'هات‌داگ صنعتی',
            categoryFa: 'گوشت فرآوری با نگهدارنده',
            image: './assets/images/hotdog.png',
            color: '#c2185b',
            splashColors: ['#880e4f', '#c2185b', '#f57f17', '#212121'],
            harmFa: 'گوشت فرآوری\u200cشده اغلب نمک زیادی دارد که می\u200cتواند فشار خون را بالا ببرد.',
            risksFa: [{ title: 'فشار خون بالا', description: 'گوشت فرآوری\u200cشده اغلب نمک زیادی دارد که می\u200cتواند فشار خون را بالا ببرد.' }, { title: 'بیماری قلبی', description: 'نمک و چربی اشباع زیاد در رژیم غذایی خطر بیماری قلبی را افزایش می\u200cدهند.' }]
        },
        {
            id: 'chips',
            toastLabelFa: 'نمک زیاد',
            nameFa: 'چیپس روغنی نمکی',
            categoryFa: 'اسید چرب اشباع و نمک غلیظ',
            image: './assets/images/chips.png',
            color: '#f57f17',
            splashColors: ['#f57f17', '#ffb300', '#d84315', '#212121'],
            harmFa: 'نمک زیاد با افزایش فشار خون، خطر بیماری قلبی و سکته را بالا می\u200cبرد.',
            risksFa: [{ title: 'خطر حمله قلبی', description: 'نمک زیاد با افزایش فشار خون، خطر بیماری قلبی و سکته را بالا می\u200cبرد.' }, { title: 'فشار خون بالا', description: 'چیپس شور سدیم زیادی دارد و مصرف زیاد آن برای فشار خون مناسب نیست.' }, { title: 'بیماری کلیوی', description: 'رژیم پرنمک می\u200cتواند خطر بیماری کلیوی را افزایش دهد.' }]
        },
        {
            id: 'cake',
            toastLabelFa: 'قند و چربی زیاد',
            nameFa: 'کیک خامه‌ای سنگین',
            categoryFa: 'شکر سفید و روغن قنادی',
            image: './assets/images/cake.png',
            color: '#6a1b9a',
            splashColors: ['#6a1b9a', '#ad1457', '#e91e63', '#212121'],
            harmFa: 'کیک خامه\u200cای معمولاً قند افزوده و انرژی زیادی دارد.',
            risksFa: [{ title: 'افزایش وزن', description: 'کیک خامه\u200cای معمولاً قند افزوده و انرژی زیادی دارد.' }, { title: 'دیابت نوع ۲', description: 'مصرف زیاد شیرینی می\u200cتواند از راه افزایش وزن به خطر دیابت نوع ۲ کمک کند.' }, { title: 'بیماری قلبی', description: 'چربی اشباع خامه و روغن قنادی می\u200cتواند کلسترول LDL را بالا ببرد.' }]
        },
        {
            id: 'cookie',
            toastLabelFa: 'قند و چربی زیاد',
            nameFa: 'کوکی کارخانه‌ای',
            categoryFa: 'روغن پالم و شیرین‌کننده',
            image: './assets/images/cookie.png',
            color: '#6d4c41',
            splashColors: ['#4e342e', '#6d4c41', '#8d6e63', '#212121'],
            harmFa: 'قند افزوده کوکی به پوسیدگی دندان کمک می\u200cکند.',
            risksFa: [{ title: 'پوسیدگی دندان', description: 'قند افزوده کوکی به پوسیدگی دندان کمک می\u200cکند.' }, { title: 'بیماری قلبی', description: 'بعضی کوکی\u200cها چربی اشباع زیادی دارند که می\u200cتواند کلسترول LDL را بالا ببرد.' }, { title: 'افزایش وزن', description: 'تنقلات پرانرژی در صورت مصرف زیاد به افزایش وزن کمک می\u200cکنند.' }]
        },
        {
            id: 'icecream',
            toastLabelFa: 'قند و چربی زیاد',
            nameFa: 'بستنی پرچرب صنعتی',
            categoryFa: 'خامه چرب و قند متراکم',
            image: './assets/images/icecream.png',
            color: '#c2185b',
            splashColors: ['#c2185b', '#8e24aa', '#3949ab', '#212121'],
            harmFa: 'قند و خامه بستنی انرژی زیادی فراهم می\u200cکنند.',
            risksFa: [{ title: 'افزایش وزن', description: 'قند و خامه بستنی انرژی زیادی فراهم می\u200cکنند.' }, { title: 'دیابت نوع ۲', description: 'مصرف زیاد خوراکی\u200cهای قندی می\u200cتواند از راه افزایش وزن خطر دیابت نوع ۲ را بالا ببرد.' }, { title: 'بیماری قلبی', description: 'خامه پرچرب منبع چربی اشباع است که می\u200cتواند کلسترول LDL را افزایش دهد.' }]
        },
        {
            "id": "lavashak",
            "nameFa": "لواشک شور یا قندی",
            "toastLabelFa": "نمک یا قند افزوده",
            "categoryFa": "نمک یا قند افزوده",
            "image": "./assets/images/lavashak.png",
            "color": "#ad2948",
            "splashColors": [
                "#ad2948",
                "#ffb94d",
                "#c72b46"
            ],
            "harmFa": "نمک افزوده زیاد در لواشک شور می‌تواند فشار خون را بالا ببرد.",
            "risksFa": [
                {
                    "title": "فشار خون بالا",
                    "description": "نمک افزوده زیاد در لواشک شور می‌تواند فشار خون را بالا ببرد."
                },
                {
                    "title": "پوسیدگی دندان",
                    "description": "لواشک قندی و چسبنده در صورت مصرف مکرر می‌تواند به پوسیدگی دندان کمک کند."
                }
            ]
        },
        {
            "id": "cheese-puffs",
            "nameFa": "پفک پنیری شور",
            "toastLabelFa": "نمک زیاد",
            "categoryFa": "نمک زیاد",
            "image": "./assets/images/cheese-puffs.png",
            "color": "#ef8526",
            "splashColors": [
                "#ef8526",
                "#ffb94d",
                "#c72b46"
            ],
            "harmFa": "نمک زیاد با افزایش فشار خون، خطر بیماری قلبی و سکته را بالا می‌برد.",
            "risksFa": [
                {
                    "title": "سکته قلبی",
                    "description": "نمک زیاد با افزایش فشار خون، خطر بیماری قلبی و سکته را بالا می‌برد."
                },
                {
                    "title": "فشار خون بالا",
                    "description": "پفک شور می‌تواند سدیم زیادی به رژیم غذایی اضافه کند."
                },
                {
                    "title": "افزایش وزن",
                    "description": "مصرف مکرر تنقلات پرانرژی می‌تواند به افزایش وزن کمک کند."
                }
            ]
        },
        {
            "id": "smarties",
            "nameFa": "اسمارتیس شکلاتی",
            "toastLabelFa": "قند زیاد",
            "categoryFa": "قند زیاد",
            "image": "./assets/images/smarties.png",
            "color": "#7751ab",
            "splashColors": [
                "#7751ab",
                "#ffb94d",
                "#c72b46"
            ],
            "harmFa": "مصرف زیاد شیرینی می‌تواند از راه افزایش وزن، خطر دیابت نوع ۲ را افزایش دهد.",
            "risksFa": [
                {
                    "title": "دیابت نوع ۲",
                    "description": "مصرف زیاد شیرینی می‌تواند از راه افزایش وزن، خطر دیابت نوع ۲ را افزایش دهد."
                },
                {
                    "title": "پوسیدگی دندان",
                    "description": "قند اسمارتیس می‌تواند به پوسیدگی دندان کمک کند."
                },
                {
                    "title": "افزایش وزن",
                    "description": "اسمارتیس قند و انرژی زیادی دارد و باید در مقدار کم مصرف شود."
                }
            ]
        },
        {
            "id": "chocolate",
            "nameFa": "شکلات شیری قندی",
            "toastLabelFa": "قند و چربی زیاد",
            "categoryFa": "قند و چربی زیاد",
            "image": "./assets/images/chocolate.png",
            "color": "#754a36",
            "splashColors": [
                "#754a36",
                "#ffb94d",
                "#c72b46"
            ],
            "harmFa": "شکلات شیری قندی انرژی زیادی دارد؛ مصرف زیاد آن می‌تواند به افزایش وزن کمک کند.",
            "risksFa": [
                {
                    "title": "افزایش وزن",
                    "description": "شکلات شیری قندی انرژی زیادی دارد؛ مصرف زیاد آن می‌تواند به افزایش وزن کمک کند."
                },
                {
                    "title": "پوسیدگی دندان",
                    "description": "قند افزوده شکلات در صورت مصرف مکرر به پوسیدگی دندان کمک می‌کند."
                },
                {
                    "title": "بیماری قلبی",
                    "description": "چربی اشباع زیاد در رژیم غذایی می‌تواند کلسترول LDL را افزایش دهد."
                }
            ]
        },
        {
            "id": "salt",
            "nameFa": "نمک زیاد",
            "toastLabelFa": "سدیم زیاد",
            "categoryFa": "سدیم زیاد",
            "image": "./assets/images/salt.png",
            "color": "#b7cad4",
            "splashColors": [
                "#b7cad4",
                "#ffb94d",
                "#c72b46"
            ],
            "harmFa": "مصرف زیاد نمک فشار خون و خطر بیماری قلبی و سکته را بالا می‌برد.",
            "risksFa": [
                {
                    "title": "سکته قلبی",
                    "description": "مصرف زیاد نمک فشار خون و خطر بیماری قلبی و سکته را بالا می‌برد."
                },
                {
                    "title": "فشار خون بالا",
                    "description": "دریافت زیاد سدیم از نمک می‌تواند فشار خون را بالا ببرد."
                },
                {
                    "title": "بیماری کلیوی",
                    "description": "رژیم غذایی پرنمک می‌تواند خطر بیماری کلیوی را افزایش دهد."
                }
            ]
        },
        {
            "id": "lollipop",
            "nameFa": "آب‌نبات چوبی",
            "toastLabelFa": "قند زیاد",
            "categoryFa": "قند افزوده و تماس طولانی با دندان",
            "image": "./assets/images/lollipop.png",
            "color": "#e54550",
            "splashColors": [
                "#e54550",
                "#ffffff",
                "#f6a6b5"
            ],
            "harmFa": "قند آب‌نبات چوبی و تماس طولانی آن با دندان می‌تواند به پوسیدگی دندان کمک کند.",
            "risksFa": [
                {
                    "title": "پوسیدگی دندان",
                    "description": "مکیدن طولانی آب‌نبات چوبی، دندان‌ها را بیشتر در معرض قند قرار می‌دهد."
                },
                {
                    "title": "افزایش وزن",
                    "description": "آب‌نبات چوبی قند افزوده دارد و مصرف زیاد شیرینی به افزایش وزن کمک می‌کند."
                },
                {
                    "title": "دیابت نوع ۲",
                    "description": "مصرف زیاد خوراکی‌های قندی می‌تواند از راه افزایش وزن خطر دیابت نوع ۲ را بالا ببرد."
                }
            ]
        }
    ]
};

// ابزار تبدیل اعداد انگلیسی به فارسی
export function toPersianDigits(num) {
    if (num === null || num === undefined) return '';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}
