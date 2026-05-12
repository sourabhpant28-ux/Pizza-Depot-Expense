/**
 * Seed script — inserts all 57 Pizza Depot stores into Supabase.
 *
 * Run with:
 *   npx tsx scripts/seed-stores.ts
 *
 * Requires the stores table to have the extra columns from:
 *   supabase/add-store-columns.sql
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local from the project root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Store data ──────────────────────────────────────────────

const stores = [
  { name: "Springdale - Peter Robertson Pizza Depot",     store_code: "SPDL01",    city: "Brampton",        province: "Ontario",      cluster_name: "Brampton",     cluster_code: "BRAM" },
  { name: "Raylawson Pizza Depot",                         store_code: "RAYL02",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "HEARTLAKE - Wexford Pizza Depot",               store_code: "WXFD03",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "FAIRHILL Pizza Depot",                          store_code: "FAIR04",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "GORE Ebenezer Pizza Depot",                     store_code: "EBNZ05",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "West Drive Pizza Depot",                        store_code: "WEST06",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Airport Braydon Pizza Depot",                   store_code: "ARPT07",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "STEELES & FINANCIAL Pizza Depot",               store_code: "STFN08",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Wanless Pizza Depot",                           store_code: "WNLS09",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Cottrelle Pizza Depot",                         store_code: "COTR42",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "JAMES POTTER Pizza Depot",                      store_code: "JMSP10",    city: "Brampton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Doug Leavens - 9th LINE/DERRY Pizza Depot",    store_code: "DGLV11",    city: "Mississauga",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "CEREMONIAL Pizza Depot",                        store_code: "CMNL12",    city: "Mississauga",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Eglinton Pizza Depot",                          store_code: "EGTN44",    city: "Mississauga",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Malton Pizza Depot",                            store_code: "MLTN13",    city: "Mississauga",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "ORANGEVILLE Pizza Depot",                       store_code: "ORNG14",    city: "Orangeville",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Ajax Pizza Depot",                              store_code: "AJX15",     city: "Ajax",            province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "ALBION/FINCH Pizza Depot",                      store_code: "FNCH16",    city: "Toronto",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "LAWRENCE Pizza Depot",                          store_code: "LWRN17",    city: "Toronto",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Queen Pizza Depot",                             store_code: "QST25",     city: "Toronto",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "SCARBOROUGH Pizza Depot",                       store_code: "SCRB18",    city: "Scarborough",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "CAMBRIDGE Pizza Depot",                         store_code: "SGNW19",    city: "Cambridge",       province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "GUELPH Paisley Pizza Depot",                    store_code: "GLPH20",    city: "Guelph",          province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Lexington Pizza Depot",                         store_code: "LEXW21",    city: "Waterloo",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "University Pizza Depot",                        store_code: "UNI22",     city: "Waterloo",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "BRANTFORD Pizza Depot",                         store_code: "BRNT23",    city: "Brantford",       province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "HAGERSVILLE Pizza Depot",                       store_code: "HGRS24",    city: "Hagersville",     province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "OAKVILLE Pizza Depot",                          store_code: "OAK26",     city: "Oakville",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "VAUGHAN (MAPLE) Pizza Depot",                   store_code: "VGN27",     city: "Vaughan",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Whitby Pizza Depot",                            store_code: "WHTB28",    city: "Whitby",          province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Trenton Pizza Depot",                           store_code: "TRNT29",    city: "Trenton",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "STONEY CREEK Pizza Depot",                      store_code: "STN30",     city: "Hamilton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Hamilton Pizza Depot",                          store_code: "KNG31",     city: "Hamilton",        province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "ST. CATHERINE Pizza Depot - Thorold",           store_code: "THOR32",    city: "Thorold",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Niagara Falls Pizza Depot",                     store_code: "NGR33",     city: "Niagara Falls",   province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Kains Pizza Depot",                             store_code: "KNS34",     city: "London",          province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Adelaide Pizza Depot",                          store_code: "ADE35",     city: "London",          province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Woodstock Pizza Depot",                         store_code: "WDST36",    city: "Woodstock",       province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Chatham Pizza Depot",                           store_code: "CHTM37",    city: "Chatham",         province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Wyandotte St Pizza Depot 1 - Windsor",          store_code: "WYND38",    city: "Windsor",         province: "Ontario",      cluster_name: "Windsor",      cluster_code: "WIND" },
  { name: "Provincial Pizza Depot 2 - Windsor",            store_code: "PRVN39",    city: "Windsor",         province: "Ontario",      cluster_name: "Windsor",      cluster_code: "WIND" },
  { name: "Tecumseh Rd Pizza Depot 3 - Windsor",           store_code: "TCMH40",    city: "Windsor",         province: "Ontario",      cluster_name: "Windsor",      cluster_code: "WIND" },
  { name: "Howard Pizza Depot 4 - Windsor",                store_code: "HWRD41",    city: "Windsor",         province: "Ontario",      cluster_name: "Windsor",      cluster_code: "WIND" },
  { name: "Kitchener Pizza Depot",                         store_code: "KITCHENER", city: "Kitchener",       province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "Sarnia Pizza Depot",                            store_code: "SRN42",     city: "Sarnia",          province: "Ontario",      cluster_name: "GTA",          cluster_code: "GTA"  },
  { name: "EDMONTON Pizza Depot",                          store_code: "EDM01",     city: "Edmonton",        province: "Alberta",      cluster_name: "Calgary",      cluster_code: "CALG" },
  { name: "Calgary Pizza Depot",                           store_code: "FLCN02",    city: "Calgary",         province: "Alberta",      cluster_name: "Calgary",      cluster_code: "CALG" },
  { name: "Woodpark Pizza Depot",                          store_code: "WOOD04",    city: "Calgary",         province: "Alberta",      cluster_name: "Calgary",      cluster_code: "CALG" },
  { name: "Red Embers Pizza Depot",                        store_code: "RDEM03",    city: "Calgary",         province: "Alberta",      cluster_name: "Calgary",      cluster_code: "CALG" },
  { name: "REGINA Pizza Depot",                            store_code: "REG01",     city: "Saskatchewan",    province: "Saskatchewan", cluster_name: "Saskatchewan", cluster_code: "SKWN" },
  { name: "SASKATOON Pizza Depot - Kensington Blvd",       store_code: "SSKT02",    city: "Saskatoon",       province: "Saskatchewan", cluster_name: "Saskatchewan", cluster_code: "SKWN" },
  { name: "North Battleford Pizza Depot",                  store_code: "NBTL03",    city: "North Battleford",province: "Saskatchewan", cluster_name: "Saskatchewan", cluster_code: "SKWN" },
  { name: "Molson Pizza Depot",                            store_code: "MOL01",     city: "Winnipeg",        province: "Manitoba",     cluster_name: "Winnipeg",     cluster_code: "WNPG" },
  { name: "Main St Pizza Depot",                           store_code: "MNST02",    city: "Winnipeg",        province: "Manitoba",     cluster_name: "Winnipeg",     cluster_code: "WNPG" },
  { name: "Mandalay Pizza Depot",                          store_code: "MND03",     city: "Winnipeg",        province: "Manitoba",     cluster_name: "Winnipeg",     cluster_code: "WNPG" },
  { name: "Roblin Pizza Depot - Charleswood",              store_code: "ROB04",     city: "Winnipeg",        province: "Manitoba",     cluster_name: "Winnipeg",     cluster_code: "WNPG" },
  { name: "Pembina Pizza Depot",                           store_code: "PMBN05",    city: "Winnipeg",        province: "Manitoba",     cluster_name: "Winnipeg",     cluster_code: "WNPG" },
]

// ─── Seed ────────────────────────────────────────────────────

async function seed() {
  console.log('🔍  Checking for existing stores…')

  // Fetch all existing store_codes
  const { data: existing, error: fetchError } = await supabase
    .from('stores')
    .select('store_code')
    .limit(1000)

  if (fetchError) {
    console.error('❌  Failed to fetch existing stores:', fetchError.message)
    process.exit(1)
  }

  const existingCodes = new Set((existing ?? []).map((s: { store_code: string | null }) => s.store_code))

  // Split into insert vs skip
  const toInsert = stores.filter((s) => !existingCodes.has(s.store_code))
  const skipped  = stores.length - toInsert.length

  if (toInsert.length === 0) {
    console.log(`✅  All ${stores.length} stores already exist — nothing to insert.`)
    return
  }

  console.log(`📦  Inserting ${toInsert.length} stores… (${skipped} already exist, skipping)`)

  // Insert in batches of 20 to stay within limits
  const BATCH = 20
  let inserted = 0

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map((s) => ({
      name:         s.name,
      store_code:   s.store_code,
      city:         s.city,
      province:     s.province,
      cluster_name: s.cluster_name,
      cluster_code: s.cluster_code,
      location:     `${s.city}, ${s.province}`,
      active:       true,
    }))

    const { error } = await supabase.from('stores').insert(batch)

    if (error) {
      console.error(`❌  Error inserting batch ${i / BATCH + 1}:`, error.message)
      process.exit(1)
    }

    inserted += batch.length
    console.log(`   ✓  Batch ${i / BATCH + 1}: inserted ${batch.length} stores (${inserted} total so far)`)
  }

  console.log('')
  console.log('─────────────────────────────────────')
  console.log(`✅  Done!`)
  console.log(`   Inserted : ${inserted}`)
  console.log(`   Skipped  : ${skipped}`)
  console.log(`   Total    : ${stores.length}`)
  console.log('─────────────────────────────────────')
}

seed()
