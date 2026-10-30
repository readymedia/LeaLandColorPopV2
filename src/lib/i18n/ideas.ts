import type { Lang } from './dict';

/** Ideer og historie-byggeklosser, overført fra v1 og utvidet. */
export const IDEAS: Record<Lang, string[]> = {
  no: [
    'En søt dinosaur som spiser is', 'En magisk enhjørning i en glitrende skog', 'En robot som spiller fotball med en katt',
    'Et slott som svever på en sky', 'Katter i teselskap med hatter', 'En astronauthund på månen',
    'En hval som flyr med ballonger over byen', 'Et trehus fylt med godteri og sklier', 'En sjiraff med langt skjerf og briller',
    'En pingvin på surfebrett', 'En liten fe som tryller frem blomster', 'Et snilt monster som pusser tennene',
    'En superheltvalp med kappe', 'En skilpadde med rakettmotor', 'En dansende kaktus med maracas',
    'Et hus av gulost med mus som bor der', 'En drage som griller pølser', 'En rev som maler et bilde i skogen',
    'En bjørn som spiller gitar ved leirbålet', 'En frosk med krone på et vannliljeblad', 'En havfrue som leker med delfiner',
    'En lama med solbriller', 'En elefant som vanner blomster med snabelen', 'En ugle som leser i et bibliotek-tre',
    'En hamster som kjører racerbil', 'En blekksprut som spiller trommer', 'En løve som sover i hengekøye',
    'Barn som bygger et kjempestort sandslott', 'En sykkel som kan fly', 'En campingtur under stjernehimmelen',
    'En piknik i parken med masse frukt', 'Et korps med trommer og trompeter', 'En bondegård med traktor og dyr',
    'Et tivoli med karuseller', 'En godteributikk med sjokoladefontene', 'Et bakeri med levende muffins',
    'En undervannsby med fiskehus', 'En jungel med fossefall og papegøyer', 'En hemmelig hule med krystaller',
    'En iglo på Nordpolen med nordlys', 'En skole for trollmenn', 'Et verksted der nisser lager leker',
    'En snømann som soler seg på stranda', 'En vulkan som spruter popcorn', 'En ryggsekk med rakettmotor',
    'En mus som går på ski i fjellet', 'Et romskip formet som en jordbærkake', 'En troll-familie på hyttetur',
  ],
  en: [
    'A cute dinosaur eating ice cream', 'A magical unicorn in a sparkling forest', 'A robot playing football with a cat',
    'A castle floating on a cloud', 'Cats having a tea party with hats', 'An astronaut dog on the moon',
    'A whale flying with balloons over the city', 'A treehouse full of sweets and slides', 'A giraffe with a long scarf and glasses',
    'A penguin on a surfboard', 'A tiny fairy making flowers appear', 'A kind monster brushing its teeth',
    'A superhero puppy with a cape', 'A turtle with a rocket engine', 'A dancing cactus with maracas',
    'A dragon grilling sausages', 'A fox painting a picture in the woods', 'A bear playing guitar by the campfire',
    'A frog with a crown on a lily pad', 'A mermaid playing with dolphins', 'A llama wearing sunglasses',
    'An owl reading in a library tree', 'A hamster driving a race car', 'An octopus playing drums',
    'Kids building a giant sandcastle', 'A flying bicycle', 'A camping trip under the stars',
    'An underwater city with fish houses', 'A jungle with waterfalls and parrots', 'A secret cave full of crystals',
    'An igloo at the North Pole with northern lights', 'A school for wizards', 'A volcano erupting popcorn',
  ],
};

export const BUILDER: Record<Lang, Record<'who' | 'doing' | 'where' | 'extra', string[]>> = {
  no: {
    who: ['en valp', 'en kattunge', 'en drage', 'et romvesen', 'en skilpadde', 'en løve', 'en panda', 'en hai', 'en sommerfugl', 'en rev', 'en ugle', 'en enhjørning', 'en dinosaur', 'en hamster', 'en blekksprut', 'en alv', 'en robot', 'et troll', 'en prinsesse', 'en ridder'],
    doing: ['spiser pizza', 'danser ballett', 'kjører racerbil', 'leser en bok', 'sover', 'spiller gitar', 'flyr helikopter', 'lager mat', 'hopper paradis', 'sykler', 'fanger sommerfugler', 'kjører skateboard', 'spiller fotball', 'maler et bilde', 'bygger med klosser', 'baker kake'],
    where: ['i verdensrommet', 'under vann', 'i godteriland', 'på skolen', 'i jungelen', 'på stranda', 'i en trehytte', 'på et sirkus', 'i en magisk skog', 'på Nordpolen', 'i en stor by', 'på en bondegård', 'i et slott', 'på tivoli', 'i en hule', 'på fjellet'],
    extra: ['med store øyne', 'som superhelt', 'med hatt', 'med masse blomster', 'i pysjamas', 'med solbriller', 'som baby', 'med kappe', 'med ballonger', 'med vinger', 'med krone', 'som glitrer'],
  },
  en: {
    who: ['a puppy', 'a kitten', 'a dragon', 'an alien', 'a turtle', 'a lion', 'a panda', 'a shark', 'a butterfly', 'a fox', 'an owl', 'a unicorn', 'a dinosaur', 'a hamster', 'an octopus', 'an elf', 'a robot', 'a troll', 'a princess', 'a knight'],
    doing: ['eating pizza', 'doing ballet', 'driving a race car', 'reading a book', 'sleeping', 'playing guitar', 'flying a helicopter', 'cooking', 'playing hopscotch', 'riding a bike', 'catching butterflies', 'skateboarding', 'playing football', 'painting a picture', 'building with blocks', 'baking a cake'],
    where: ['in space', 'under water', 'in candy land', 'at school', 'in the jungle', 'on the beach', 'in a treehouse', 'at the circus', 'in a magic forest', 'at the North Pole', 'in a big city', 'on a farm', 'in a castle', 'at the fair', 'in a cave', 'in the mountains'],
    extra: ['with big eyes', 'as a superhero', 'wearing a hat', 'with lots of flowers', 'in pyjamas', 'with sunglasses', 'as a baby', 'with a cape', 'with balloons', 'with wings', 'with a crown', 'that sparkles'],
  },
};
