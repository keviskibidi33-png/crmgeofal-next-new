import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

const repoRoot = path.resolve(process.cwd());
const ensayosSourceDir = path.resolve(repoRoot, '..', 'Ensayos');
const outputPath = path.resolve(repoRoot, 'src', 'data', 'ensayos-data.ts');

const csvCatalog = [
  ['CEMENTO.csv', 'CEMENTO'],
  ['ENSAYO CONCRETO.csv', 'ENSAYO CONCRETO'],
  ['ENSAYO CONCRETO DE CAMPO.csv', 'ENSAYO CONCRETO DE CAMPO'],
  ['ENSAYO AGREGADO.csv', 'ENSAYO AGREGADO'],
  ['ENSAYO ALBAÑILERÍA.csv', 'ENSAYO ALBAÑILERÍA'],
  ['ENSAYO ESTÁNDAR SUELO.csv', 'ENSAYO ESTÁNDAR SUELO'],
  ['ENSAYO MEZCLA ASFÁLTICA.csv', 'ENSAYO MEZCLA ASFÁLTICA'],
  ['ENSAYO PAVIMENTO EN CAMPO Y LABORATORIO.csv', 'ENSAYO PAVIMENTO EN CAMPO Y LABORATORIO'],
  ['ENSAYO QUÍMICO AGREGADO.csv', 'ENSAYO QUÍMICO AGREGADO'],
  ['ENSAYO QUÍMICO EN CONCRETO.csv', 'ENSAYO QUÍMICO EN CONCRETO'],
  ['ENSAYO QUÍMICO SUELO Y AGUA SUBTERRÁNEO.csv', 'ENSAYO QUÍMICO SUELO Y AGUA SUBTERRÁNEO'],
  ['ENSAYO ROCA.csv', 'ENSAYO ROCA'],
  ['ENSAYOS DE CAMPO EN SUELO.csv', 'ENSAYOS DE CAMPO EN SUELO'],
  ['ENSAYOS ESPECIALES SUELO.csv', 'ENSAYOS ESPECIALES SUELO'],
  ['EVALUACIONES ESTRUCTURALES.csv', 'EVALUACIONES ESTRUCTURALES'],
  ['OTROS SERVICIOS.csv', 'OTROS SERVICIOS']
];

const sanitize = (value = '', preserveNewlines = false) => {
  let normalized = (value || '').replace(/\u00a0/g, ' ').trim();
  if (preserveNewlines) {
    return normalized.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
  }
  return normalized.replace(/\s+/g, ' ');
};

const toNumber = (value) => {
  if (!value) return 0;
  const num = Number(value.replace(/,/g, '.'));
  return Number.isFinite(num) ? num : 0;
};

const detectRelatedCode = (text) => {
  if (!text) return null;
  const match = text.match(/requier[ea].*?([A-Z]{2,}\d+[A-Z]?)/i);
  return match ? match[1].toUpperCase() : null;
};

const escapeTsString = (value) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

async function loadCsv(fileName, category) {
  console.log(`Loading CSV for category: ${category}`);
  console.log(`Attempting to load file: ${fileName}`);
  const filePath = path.resolve(ensayosSourceDir, fileName);
  console.log(`Checking if file exists: ${filePath}`);
  try {
    const buffer = await fs.readFile(filePath);
    const content = iconv.decode(buffer, 'win1252');
    console.log(`File decoded successfully with win1252`);
    const records = parse(content, { delimiter: ';', skip_empty_lines: true, trim: false, from_line: 2, columns: false }); // Start from data rows, access by index
    console.log(`Parsed ${records.length} records from CSV`);
    return records.map(row => {
      const rawCodigo = row[0] || '';
      console.log(`Raw codigo for row: '${rawCodigo}'`);
      const codigo = sanitize(rawCodigo);
      if (!codigo) {
        console.log(`Skipping row due to empty codigo after sanitization. Raw data:`, row);
        return null;
      }
      const descripcion = sanitize(row[1], true);
      const norma = sanitize(row[2]) || '-';
      const acreditado = sanitize(row[3]) || 'NO';
      const referenciaOtraNorma = sanitize(row[4]) || '-';
      const ubicacion = sanitize(row[5]) || 'LABORATORIO';
      const precioTexto = sanitize(row[6]);
      const precio = toNumber(precioTexto);
      const tiempo = sanitize(row[7]) || '';
      const comentariosRaw = sanitize(row[8], true);
      const comentarios = precioTexto && comentariosRaw ? `${comentariosRaw}
Precio referencia: ${precioTexto}` : (comentariosRaw || '');
      const relatedFromComment = detectRelatedCode(comentariosRaw);
      return {
        codigo,
        descripcion,
        norma,
        acreditado,
        referenciaOtraNorma,
        ubicacion,
        precio,
        tiempo,
        comentarios,
        category,
        codigoRelacionado: relatedFromComment,
      };
    }).filter(Boolean);
  } catch (error) {
    console.error(`Error with file ${fileName}: ${error.message}`);
    return [];
  }
}

const formatEntry = (item) => {
  const lines = [
    `    codigo: '${escapeTsString(item.codigo)}',`,
    `    descripcion: '${escapeTsString(item.descripcion)}',`,
    `    norma: '${escapeTsString(item.norma)}',`,
    `    acreditado: '${escapeTsString(item.acreditado)}',`,
    `    referenciaOtraNorma: '${escapeTsString(item.referenciaOtraNorma)}',`,
    `    ubicacion: '${escapeTsString(item.ubicacion)}',`,
    `    precio: ${item.precio},`,
    `    tiempo: '${escapeTsString(item.tiempo)}',`,
    `    comentarios: '${escapeTsString(item.comentarios)}',`,
    `    categoria: '${escapeTsString(item.categoria)}',`,
  ];
  if (item.codigoRelacionado) {
    lines.push(`    codigoRelacionado: '${escapeTsString(item.codigoRelacionado)}',`);
  }
  return `  {\n${lines.join('\n')}\n  }`;
};

async function generate() {
  console.log(`Starting generation. Source dir: ${ensayosSourceDir}`);
  let allEntries = [];
  for (const [fileName, category] of csvCatalog) {
    console.log(`Processing file: ${fileName}`);
    const entries = await loadCsv(fileName, category);
    console.log(`Loaded ${entries.length} entries from ${fileName}`);
    allEntries = allEntries.concat(entries);
  }
  console.log(`Total entries collected: ${allEntries.length}`);
  const entriesLiteral = allEntries.map(formatEntry).join(',\n\n');
  const fileContents = `export interface EnsayoItem {\n  codigo: string;\n  descripcion: string;\n  norma: string;\n  acreditado: string;\n  referenciaOtraNorma: string;\n  ubicacion: string;\n  precio: number;\n  tiempo: string;\n  comentarios: string;\n  categoria: string;\n  codigoRelacionado?: string;\n}\n\nexport const ensayosData: EnsayoItem[] = [\n${entriesLiteral}\n];\n\nexport const searchEnsayos = (query: string): EnsayoItem[] => {\n  if (!query || query.length < 2) return [];\n  const lower = query.toLowerCase();\n  return ensayosData.filter((item) =>\n    item.codigo.toLowerCase().includes(lower) ||\n    item.descripcion.toLowerCase().includes(lower)\n  );\n};\n\nexport const getEnsayoByCodigo = (codigo: string): EnsayoItem | undefined => {\n  return ensayosData.find((item) => item.codigo === codigo);\n};\n\nexport const getEnsayosRelacionados = (codigo: string): EnsayoItem[] => {\n  const ensayo = getEnsayoByCodigo(codigo);\n  if (!ensayo || !ensayo.codigoRelacionado) return [];\n  return ensayosData.filter((item) => item.codigo === ensayo.codigoRelacionado);\n};\n\nexport const getCategorias = (): string[] => {\n  return [...new Set(ensayosData.map((item) => item.categoria))];\n};\n`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, fileContents, 'utf8');
  console.log(`Generated ${allEntries.length} ensayos in ${path.relative(repoRoot, outputPath)}.`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
