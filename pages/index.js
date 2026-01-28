import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  LabelList,
} from 'recharts'
import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  differenceInMinutes,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'

// Configuración de tags por categoría
const TAG_CATEGORIES = {
  start: [
    'startMessage_A',
    'startMessage_B',
    'startMessage_C',
    'startMessage_D',
    'startMessage_E',
  ],
  second: [
    'secondMessage_A',
    'secondMessage_B',
    'secondMessage_C',
    'secondMessage_D',
    'secondMessageFollowUp',
  ],
  final: [
    'finalMessage_A',
    'finalMessage_B',
    'finalMessage_C',
    'finalMessage_D',
    'finalMessageFollowUp',
  ],
  lead: ['goodByeMessage_afterLeadCreated'],
}

// Tags para el selector de conversión (sin follow-ups ni mensajes de cierre)
const CONVERSION_TAGS = {
  start: [
    'startMessage_A',
    'startMessage_B',
    'startMessage_C',
    'startMessage_D',
    'startMessage_E',
  ],
  second: [
    'secondMessage_A',
    'secondMessage_B',
    'secondMessage_C',
    'secondMessage_D',
  ],
  final: [
    'finalMessage_A',
    'finalMessage_B',
    'finalMessage_C',
    'finalMessage_D',
  ],
}

const CONVERSION_CATEGORY_LABELS = {
  start: 'Start Messages',
  second: 'Second Messages',
  final: 'Final Messages',
}

// Textos completos de los mensajes para el mockup
const MESSAGE_TEXTS = {
  startMessage_A: "Hey ya estoy aquí, muchas gracias por seguirnos! quiero preguntarte algo, ¿Nos empezaste a seguir por el contenido o te gustaría que te cuente cómo trabajamos para encontrar viviendas con mejor calidad-precio usando IA?",
  startMessage_B: "Hola, te interesa saber mas sobre nuestra IA?",
  startMessage_C: "Gracias por el follow, quieres que nuestra IA te encuentre casa?",
  startMessage_D: "Nuestra IA solo esta disponible para gente que quiere una casa, es tu caso?",
  startMessage_E: "Nuestra IA solo esta disponible para gente que quiere comprar y vender, cual es tu caso?",
  secondMessage_A: "Hey, soy Jorge muchas gracias por seguirnos. Te gustaría que te cuente cómo trabajamos para encontrar viviendas con mejor calidad-precio usando IA?",
  secondMessage_B: "Hola soy Jorge muchas gracias por seguirnos! Te gustaría que te cuente cómo trabajamos para encontrar viviendas con mejor calidad-precio usando IA?",
  secondMessage_C: "Súper, antes de contarte como trabajamos, damos servicio en toda España, pero solo en compra, no en alquiler. ¿Tú estás comprando?",
  secondMessage_D: "Hey, soy Jorge muchas gracias por seguirnos. Te gustaría que te cuente cómo te podemos ayudar a comprar casa con mejor calidad-precio usando IA?",
  finalMessage_A: "Perfecto, te explico como trabajamos muy rápido. Lo que habrás comprobado es que ahora mismo encontrar buenas oportunidades de vivienda es muy difícil. Por eso creamos una IA que busca por todo internet y te manda solo las mejores opciones.",
  finalMessage_B: "Perfecto, te lo explico rápido. Como habras visto ahora mismo encontrar buenas oportunidades es complicado, por eso usamos una IA que busca por todo internet y te envía solo las mejores opciones. Si alguna encaja, nos encargamos también de negociar el precio y de todo el proceso. Es un servicio llevado por un equipo profesional apoyado en IA, así que me gustaría conocer tu caso para ver si encaja. Si te interesa, déjame tu número y seguimos por WhatsApp. ¡Gracias!",
  finalMessage_C: "🎧 Audio: Explicación para compradores",
  finalMessage_D: "🎧 Audio: Explicación para vendedores",
}

const ALL_TAGS = [
  ...TAG_CATEGORIES.start,
  ...TAG_CATEGORIES.second,
  ...TAG_CATEGORIES.final,
  'goodByeMessage_afterLeadCreated',
  'goodByeMessage_afterJustContent',
  'goodByeMessage_afterNotInterested',
  'phoneFollowUp',
]

const TAG_LABELS = {
  startMessage_A: 'Start A',
  startMessage_B: 'Start B',
  startMessage_C: 'Start C',
  startMessage_D: 'Start D',
  startMessage_E: 'Start E',
  secondMessage_A: 'Second A',
  secondMessage_B: 'Second B',
  secondMessage_C: 'Second C',
  secondMessage_D: 'Second D',
  secondMessageFollowUp: 'Second Follow-up',
  finalMessage_A: 'Final A',
  finalMessage_B: 'Final B',
  finalMessage_C: 'Final C',
  finalMessage_D: 'Final D',
  finalMessageFollowUp: 'Final Follow-up',
  goodByeMessage_afterLeadCreated: 'Lead Creado',
  goodByeMessage_afterJustContent: 'Solo Contenido',
  goodByeMessage_afterNotInterested: 'No Interesado',
  phoneFollowUp: 'Pedir Teléfono',
}

export default function Dashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalRecords, setTotalRecords] = useState(0)

  // Filtros
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [groupBy, setGroupBy] = useState('day') // day, week, month
  const [selectedTags, setSelectedTags] = useState(['startMessage_A', 'startMessage_B'])
  const [visibleSeries, setVisibleSeries] = useState(['start', 'second', 'final', 'leads'])
  const [conversionCategory, setConversionCategory] = useState('start') // start, second, final

  // Fetch data con paginación para superar el límite de 1000
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const allData = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      // Formato de fechas para Supabase
      const fromDate = `${startDate}T00:00:00.000Z`
      const toDate = `${endDate}T23:59:59.999Z`

      console.log('Fetching data from', fromDate, 'to', toDate)

      while (hasMore) {
        const { data: conversations, error: fetchError } = await supabase
          .from('ig_conversations')
          .select('*')
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (fetchError) throw fetchError

        if (conversations && conversations.length > 0) {
          allData.push(...conversations)
          console.log(`Page ${page + 1}: fetched ${conversations.length} records`)
          hasMore = conversations.length === pageSize
          page++
        } else {
          hasMore = false
        }
      }

      console.log(`Total records fetched: ${allData.length}`)
      setData(allData)
      setTotalRecords(allData.length)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  // Fetch inicial y cuando cambian las fechas
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Función para agrupar por período
  const getGroupKey = useCallback((dateStr) => {
    const date = parseISO(dateStr)
    switch (groupBy) {
      case 'week':
        return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      case 'month':
        return format(startOfMonth(date), 'yyyy-MM')
      default:
        return format(date, 'yyyy-MM-dd')
    }
  }, [groupBy])

  const formatGroupLabel = useCallback((key) => {
    try {
      switch (groupBy) {
        case 'week':
          return `Sem ${format(parseISO(key), 'dd MMM', { locale: es })}`
        case 'month':
          return format(parseISO(`${key}-01`), 'MMM yyyy', { locale: es })
        default:
          return format(parseISO(key), 'dd MMM', { locale: es })
      }
    } catch (e) {
      return key
    }
  }, [groupBy])

  // Procesamiento de datos para el gráfico de barras + línea
  const deliveriesData = useMemo(() => {
    const grouped = {}

    data.forEach((msg) => {
      if (msg.direction !== 'outbound' || !msg.message_tag) return

      const key = getGroupKey(msg.created_at)
      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          firstDeliveries: 0,
          secondDeliveries: 0,
          finalDeliveries: 0,
          leadsCreated: 0,
        }
      }

      if (TAG_CATEGORIES.start.includes(msg.message_tag)) {
        grouped[key].firstDeliveries++
      } else if (TAG_CATEGORIES.second.includes(msg.message_tag)) {
        grouped[key].secondDeliveries++
      } else if (TAG_CATEGORIES.final.includes(msg.message_tag)) {
        grouped[key].finalDeliveries++
      }

      if (msg.message_tag === 'goodByeMessage_afterLeadCreated') {
        grouped[key].leadsCreated++
      }
    })

    return Object.values(grouped)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((item) => ({
        ...item,
        label: formatGroupLabel(item.period),
      }))
  }, [data, groupBy, getGroupKey, formatGroupLabel])

  // Cálculo del tiempo medio de respuesta
  // - Start: desde startMessage hasta inbound/second/final (primera respuesta)
  // - Otros: desde second hasta final, desde final hasta goodbye
  const responseTimeStats = useMemo(() => {
    const messagesByUser = {}

    data.forEach((msg) => {
      if (!msg.ig_username) return
      if (!messagesByUser[msg.ig_username]) {
        messagesByUser[msg.ig_username] = []
      }
      messagesByUser[msg.ig_username].push(msg)
    })

    // Ordenar por fecha
    Object.values(messagesByUser).forEach((messages) => {
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })

    const startMessageTimes = []
    const otherMessageTimes = []

    const goodbyeTags = ['goodByeMessage_afterLeadCreated', 'goodByeMessage_afterJustContent', 'goodByeMessage_afterNotInterested']

    Object.values(messagesByUser).forEach((messages) => {
      // 1. Tiempo Start → primera respuesta (inbound o siguiente outbound del funnel)
      let startMsg = null
      let startIdx = null
      for (let i = 0; i < messages.length; i++) {
        if (TAG_CATEGORIES.start.includes(messages[i].message_tag)) {
          startMsg = messages[i]
          startIdx = i
          break
        }
      }

      if (startMsg) {
        // Buscar siguiente inbound o second/final
        for (let i = startIdx + 1; i < messages.length; i++) {
          const msg = messages[i]
          const tag = msg.message_tag
          
          // Si es inbound o es second/final (indica que hubo respuesta)
          if (msg.direction === 'inbound' || TAG_CATEGORIES.second.includes(tag) || TAG_CATEGORIES.final.includes(tag)) {
            const diff = differenceInMinutes(new Date(msg.created_at), new Date(startMsg.created_at))
            if (diff > 0 && diff < 2880) {
              startMessageTimes.push(diff)
            }
            break
          }
        }
      }

      // 2. Tiempo Second → Final
      for (let i = 0; i < messages.length; i++) {
        if (TAG_CATEGORIES.second.includes(messages[i].message_tag)) {
          // Buscar siguiente final
          for (let j = i + 1; j < messages.length; j++) {
            if (TAG_CATEGORIES.final.includes(messages[j].message_tag)) {
              const diff = differenceInMinutes(new Date(messages[j].created_at), new Date(messages[i].created_at))
              if (diff > 0 && diff < 2880) {
                otherMessageTimes.push(diff)
              }
              break
            }
          }
          break
        }
      }

      // 3. Tiempo Final → Goodbye
      for (let i = 0; i < messages.length; i++) {
        if (TAG_CATEGORIES.final.includes(messages[i].message_tag)) {
          // Buscar siguiente goodbye
          for (let j = i + 1; j < messages.length; j++) {
            if (goodbyeTags.includes(messages[j].message_tag)) {
              const diff = differenceInMinutes(new Date(messages[j].created_at), new Date(messages[i].created_at))
              if (diff > 0 && diff < 2880) {
                otherMessageTimes.push(diff)
              }
              break
            }
          }
          break
        }
      }
    })

    const formatTime = (times) => {
      if (times.length === 0) return null
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const sorted = [...times].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      
      const formatMinutes = (mins) => {
        const hours = Math.floor(mins / 60)
        const minutes = Math.round(mins % 60)
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      }
      
      return {
        totalMinutes: Math.round(avg),
        formatted: formatMinutes(avg),
        medianFormatted: formatMinutes(median),
        sampleSize: times.length,
      }
    }

    return {
      startMessages: formatTime(startMessageTimes),
      otherMessages: formatTime(otherMessageTimes),
    }
  }, [data])

  // Cálculo de tasa de conversión por tag
  // LÓGICA: Un mensaje se considera "convertido" si el siguiente mensaje es un inbound
  const conversionStats = useMemo(() => {
    // Agrupar por ig_username
    const messagesByUser = {}

    data.forEach((msg) => {
      if (!msg.ig_username) return
      if (!messagesByUser[msg.ig_username]) {
        messagesByUser[msg.ig_username] = []
      }
      messagesByUser[msg.ig_username].push(msg)
    })

    // Ordenar mensajes por fecha
    Object.values(messagesByUser).forEach((messages) => {
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })

    // Tags de la categoría seleccionada
    const categoryTags = CONVERSION_TAGS[conversionCategory] || []

    // Calcular stats para todos los tags de la categoría
    const statsByTag = {}
    const conversionByTagAndPeriod = {}

    categoryTags.forEach((tag) => {
      statsByTag[tag] = { sent: 0, converted: 0 }
      conversionByTagAndPeriod[tag] = {}
    })

    // Para cada usuario, verificar si el mensaje tiene un inbound inmediatamente después
    Object.values(messagesByUser).forEach((messages) => {
      messages.forEach((msg, idx) => {
        if (msg.direction !== 'outbound' || !categoryTags.includes(msg.message_tag)) return

        const tag = msg.message_tag
        const period = getGroupKey(msg.created_at)

        if (!conversionByTagAndPeriod[tag][period]) {
          conversionByTagAndPeriod[tag][period] = { sent: 0, converted: 0 }
        }

        conversionByTagAndPeriod[tag][period].sent++
        statsByTag[tag].sent++

        // ¿El siguiente mensaje es un inbound?
        if (idx + 1 < messages.length && messages[idx + 1].direction === 'inbound') {
          conversionByTagAndPeriod[tag][period].converted++
          statsByTag[tag].converted++
        }
      })
    })

    // Calcular totales de la categoría
    const categoryTotal = {
      sent: Object.values(statsByTag).reduce((sum, s) => sum + s.sent, 0),
      converted: Object.values(statsByTag).reduce((sum, s) => sum + s.converted, 0),
    }
    categoryTotal.rate = categoryTotal.sent > 0 
      ? Math.round((categoryTotal.converted / categoryTotal.sent) * 1000) / 10 
      : 0

    // Calcular % por tag
    Object.keys(statsByTag).forEach((tag) => {
      const s = statsByTag[tag]
      s.rate = s.sent > 0 ? Math.round((s.converted / s.sent) * 1000) / 10 : 0
    })

    // Convertir a formato de gráfico (solo para tags seleccionados)
    const allPeriods = new Set()
    selectedTags.forEach((tag) => {
      if (conversionByTagAndPeriod[tag]) {
        Object.keys(conversionByTagAndPeriod[tag]).forEach((period) => allPeriods.add(period))
      }
    })

    const sortedPeriods = Array.from(allPeriods).sort()

    const chartData = sortedPeriods.map((period) => {
      const row = {
        period,
        label: formatGroupLabel(period),
      }

      selectedTags.forEach((tag) => {
        const tagData = conversionByTagAndPeriod[tag]?.[period]
        if (tagData && tagData.sent > 0) {
          row[tag] = Math.round((tagData.converted / tagData.sent) * 100)
        } else {
          row[tag] = null
        }
      })

      return row
    })

    return {
      byTag: statsByTag,
      categoryTotal,
      chartData,
    }
  }, [data, conversionCategory, selectedTags, groupBy, getGroupKey, formatGroupLabel])

  // Actualizar selectedTags cuando cambia la categoría
  const handleCategoryChange = (category) => {
    setConversionCategory(category)
    // Seleccionar los primeros 2 tags de la nueva categoría por defecto
    const newTags = CONVERSION_TAGS[category] || []
    setSelectedTags(newTags.slice(0, 2))
  }

  // Colores para los tags
  const TAG_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ]

  const handleTagToggle = (tag) => {
    // Solo permitir tags de la categoría actual
    const categoryTags = CONVERSION_TAGS[conversionCategory] || []
    if (!categoryTags.includes(tag)) return
    
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSeriesToggle = (series) => {
    setVisibleSeries((prev) =>
      prev.includes(series) ? prev.filter((s) => s !== series) : [...prev, series]
    )
  }

  const SERIES_CONFIG = {
    start: { label: 'Start Messages', color: '#3b82f6', dataKey: 'firstDeliveries' },
    second: { label: 'Second Messages', color: '#f59e0b', dataKey: 'secondDeliveries' },
    final: { label: 'Final Messages', color: '#8b5cf6', dataKey: 'finalDeliveries' },
    leads: { label: 'Leads Creados', color: '#10b981', dataKey: 'leadsCreated' },
  }

  if (loading && data.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando datos...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col">
      {/* Header fijo */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            AURA Instagram Conversations Dashboard
          </h1>

          {/* Filtros globales */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Fecha fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Agrupar por</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg font-medium transition text-sm"
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
            {totalRecords > 0 && (
              <span className="text-slate-500 text-sm">
                {totalRecords.toLocaleString()} registros
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-300">Error: {error}</p>
            </div>
          )}

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Respuesta Start Messages</p>
              <p className="text-3xl font-bold text-amber-400">
                {responseTimeStats.startMessages ? responseTimeStats.startMessages.formatted : 'N/A'}
              </p>
              {responseTimeStats.startMessages && (
                <p className="text-slate-500 text-xs mt-1">
                  Mediana: {responseTimeStats.startMessages.medianFormatted} • {responseTimeStats.startMessages.sampleSize} resp.
                </p>
              )}
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Respuesta Otros Mensajes</p>
              <p className="text-3xl font-bold text-orange-400">
                {responseTimeStats.otherMessages ? responseTimeStats.otherMessages.formatted : 'N/A'}
              </p>
              {responseTimeStats.otherMessages && (
                <p className="text-slate-500 text-xs mt-1">
                  Mediana: {responseTimeStats.otherMessages.medianFormatted} • {responseTimeStats.otherMessages.sampleSize} resp.
                </p>
              )}
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Total Mensajes</p>
              <p className="text-3xl font-bold text-blue-400">{data.length.toLocaleString()}</p>
              <p className="text-slate-500 text-xs mt-1">En el período seleccionado</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Leads Creados</p>
              <p className="text-3xl font-bold text-emerald-400">
                {data.filter((m) => m.message_tag === 'goodByeMessage_afterLeadCreated').length}
              </p>
              <p className="text-slate-500 text-xs mt-1">En el período seleccionado</p>
            </div>
          </div>

        {/* Gráfico de entregas (barras + línea) */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold">
              Entregas de Mensajes y Leads por{' '}
              {groupBy === 'day' ? 'Día' : groupBy === 'week' ? 'Semana' : 'Mes'}
            </h2>
            <div className="flex gap-2">
              {Object.entries(SERIES_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleSeriesToggle(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    visibleSeries.includes(key)
                      ? 'text-white border-transparent'
                      : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-500'
                  }`}
                  style={{
                    backgroundColor: visibleSeries.includes(key) ? config.color : undefined,
                  }}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
          {deliveriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={deliveriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8' }}
                  label={{
                    value: 'Mensajes',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#94a3b8',
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  tick={{ fill: '#10b981' }}
                  label={{
                    value: 'Leads',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#10b981',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                {visibleSeries.includes('start') && (
                  <Bar
                    yAxisId="left"
                    dataKey="firstDeliveries"
                    name="Start Messages"
                    fill="#3b82f6"
                    stackId="stack"
                    radius={[0, 0, 0, 0]}
                  >
                    <LabelList
                      dataKey="firstDeliveries"
                      position="inside"
                      fill="#fff"
                      fontSize={10}
                    />
                  </Bar>
                )}
                {visibleSeries.includes('second') && (
                  <Bar
                    yAxisId="left"
                    dataKey="secondDeliveries"
                    name="Second Messages"
                    fill="#f59e0b"
                    stackId="stack"
                  >
                    <LabelList
                      dataKey="secondDeliveries"
                      position="inside"
                      fill="#fff"
                      fontSize={10}
                    />
                  </Bar>
                )}
                {visibleSeries.includes('final') && (
                  <Bar
                    yAxisId="left"
                    dataKey="finalDeliveries"
                    name="Final Messages"
                    fill="#8b5cf6"
                    stackId="stack"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="finalDeliveries"
                      position="inside"
                      fill="#fff"
                      fontSize={10}
                    />
                  </Bar>
                )}
                {visibleSeries.includes('leads') && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="leadsCreated"
                    name="Leads Creados"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                  >
                    <LabelList
                      dataKey="leadsCreated"
                      position="top"
                      fill="#10b981"
                      fontSize={12}
                      fontWeight="bold"
                    />
                  </Line>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No hay datos con message_tag en el período seleccionado
            </div>
          )}
        </div>

        {/* Selector de tags para conversión */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold mb-4">Tasa de Conversión</h2>

          {/* Selector de categoría */}
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-2">Tipo de mensaje:</p>
            <div className="flex gap-2">
              {Object.keys(CONVERSION_TAGS).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    conversionCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {CONVERSION_CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
          </div>

          {/* Tarjetas de resumen por categoría */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {/* Tarjeta total de la categoría */}
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <p className="text-slate-400 text-xs mb-1">Total</p>
              <p className="text-2xl font-bold text-white">
                {conversionStats.categoryTotal.rate}%
              </p>
              <p className="text-slate-500 text-xs">
                {conversionStats.categoryTotal.converted}/{conversionStats.categoryTotal.sent}
              </p>
            </div>
            
            {/* Tarjetas por submensaje */}
            {CONVERSION_TAGS[conversionCategory].map((tag) => {
              const stats = conversionStats.byTag[tag] || { sent: 0, converted: 0, rate: 0 }
              const isSelected = selectedTags.includes(tag)
              const letter = tag.slice(-1) // Obtener la letra (A, B, C, D, E)
              return (
                <div 
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-lg p-3 border cursor-pointer transition ${
                    isSelected 
                      ? 'bg-blue-600/20 border-blue-500' 
                      : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <p className="text-slate-400 text-xs mb-1">{letter}</p>
                  <p className={`text-2xl font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                    {stats.rate}%
                  </p>
                  <p className="text-slate-500 text-xs">
                    {stats.converted}/{stats.sent}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Layout: Gráfico 75% + iPhone 25% */}
          <div className="flex gap-4">
            {/* Gráfico de conversión - 75% */}
            <div className="w-3/4">
              {conversionStats.chartData.length > 0 && selectedTags.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={conversionStats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8' }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#f1f5f9' }}
                      formatter={(value) => (value !== null ? `${value}%` : 'Sin datos')}
                    />
                    <Legend />
                    {selectedTags.map((tag, idx) => (
                      <Line
                        key={tag}
                        type="monotone"
                        dataKey={tag}
                        name={TAG_LABELS[tag] || tag}
                        stroke={TAG_COLORS[idx % TAG_COLORS.length]}
                        strokeWidth={2}
                        dot={{ fill: TAG_COLORS[idx % TAG_COLORS.length], strokeWidth: 2, r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-500">
                  Selecciona al menos un mensaje para ver la conversión
                </div>
              )}
            </div>

            {/* iPhone Mockup - 25% */}
            <div className="w-1/4 flex items-center justify-center">
              <div className="relative">
                {/* iPhone Frame */}
                <div className="w-48 h-96 bg-black rounded-[2.5rem] p-2 shadow-xl border-4 border-slate-600">
                  {/* Screen */}
                  <div className="w-full h-full bg-slate-100 rounded-[2rem] overflow-hidden flex flex-col">
                    {/* Status bar */}
                    <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-slate-200">
                      <div className="w-16 h-1 bg-black rounded-full mx-auto" />
                    </div>
                    
                    {/* Instagram header */}
                    <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-slate-200">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">A</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-black">aura_proptech</p>
                        <p className="text-[10px] text-slate-500">Activo ahora</p>
                      </div>
                    </div>
                    
                    {/* Chat area */}
                    <div className="flex-1 bg-white p-2 overflow-hidden">
                      {selectedTags.length > 0 && MESSAGE_TEXTS[selectedTags[0]] ? (
                        <div className="bg-slate-200 rounded-2xl rounded-bl-sm p-2.5 max-w-full">
                          <p className="text-[10px] text-black leading-tight">
                            {MESSAGE_TEXTS[selectedTags[0]]}
                          </p>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-[10px] text-slate-400 text-center">
                            Selecciona un mensaje para ver su contenido
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Input area */}
                    <div className="bg-white px-2 py-2 border-t border-slate-200">
                      <div className="bg-slate-100 rounded-full px-3 py-1.5">
                        <p className="text-[10px] text-slate-400">Mensaje...</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notch */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full" />
              </div>
            </div>
          </div>

          <p className="text-slate-500 text-xs mt-3">
            Haz clic en las tarjetas para mostrar/ocultar en el gráfico y ver el mensaje en el móvil
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm mt-8">
          <p>AURA PropTech • Dashboard de Conversaciones IG</p>
        </div>
        </div>
      </div>
    </div>
  )
}
