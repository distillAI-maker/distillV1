/**
 * The plate at the top of Your Standard: one masterpiece a day, public domain or CC0, captioned
 * like a museum placard. Architecture, philosophy and the sublime, the detail modern rooms have lost
 * (docs/DIRECTION.md, Brand). Served by Wikimedia Commons; `position` keeps the subject in frame
 * when a tall painting is cropped to the plate.
 */
export interface Artwork {
  src: string;
  title: string;
  artist: string;
  date: string;
  museum: string;
  position?: string;
}

const commons = (path: string, file: string) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}/${file}/960px-${file}`;

export const artworks: readonly Artwork[] = [
  {
    src: commons(
      'a/ac',
      'Giovanni_Paolo_Panini%2C_Interior_of_the_Pantheon%2C_Rome%2C_c._1734%2C_NGA_165.jpg',
    ),
    title: 'Interior of the Pantheon, Rome',
    artist: 'Giovanni Paolo Panini',
    date: 'c. 1734',
    museum: 'National Gallery of Art',
    position: 'center 30%',
  },
  {
    src: commons('4/49', '%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg'),
    title: 'The School of Athens',
    artist: 'Raphael',
    date: '1509–1511',
    museum: 'Vatican Museums',
    position: 'center 62%',
  },
  {
    src: commons('a/ac', 'Thomas_Cole_-_The_Oxbow_%28Met%29.jpg'),
    title: 'The Oxbow',
    artist: 'Thomas Cole',
    date: '1836',
    museum: 'The Met',
  },
  {
    src: commons('f/f2', 'Ancient_Rome_MET_DT1418.jpg'),
    title: 'Ancient Rome',
    artist: 'Giovanni Paolo Panini',
    date: '1757',
    museum: 'The Met',
  },
  {
    src: commons('b/b9', 'Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg'),
    title: 'Wanderer above the Sea of Fog',
    artist: 'Caspar David Friedrich',
    date: 'c. 1818',
    museum: 'Hamburger Kunsthalle',
    position: 'center 14%',
  },
  {
    src: commons(
      '0/00',
      'Le_pont_du_Gard_-_Hubert_Robert_-_Mus%C3%A9e_du_Louvre_Peintures_INV_7650.jpg',
    ),
    title: 'The Pont du Gard',
    artist: 'Hubert Robert',
    date: '1787',
    museum: 'The Louvre',
  },
  {
    src: commons(
      '5/5c',
      'Albert_Bierstadt_-_Among_the_Sierra_Nevada%2C_California_-_Google_Art_Project.jpg',
    ),
    title: 'Among the Sierra Nevada, California',
    artist: 'Albert Bierstadt',
    date: '1868',
    museum: 'Smithsonian American Art Museum',
  },
  {
    src: commons('a/a9', 'Lake_George_MET_DT84.jpg'),
    title: 'Lake George',
    artist: 'John Frederick Kensett',
    date: '1869',
    museum: 'The Met',
  },
];

/** Today's plate: the same for everyone on a given day, a new one tomorrow. */
export function artworkFor(date: string): Artwork {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  return artworks[((day % artworks.length) + artworks.length) % artworks.length] as Artwork;
}
