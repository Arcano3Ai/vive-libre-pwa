const localActivities = [
  { name: "Cascada Cola de Caballo", description: "Una impresionante caída de agua de 25 metros, emblemática de Santiago." },
  { name: "Presa de la Boca", description: "Ideal para paseos en lancha, pesca deportiva y disfrutar de la gastronomía local en los alrededores." },
  { name: "Pueblo Mágico de Santiago", description: "Camine por sus calles empedradas, visite la Parroquia de Santiago Apóstol y disfrute de un café en la plaza principal." },
  { name: "Matacanes (Aventura)", description: "Para los amantes del cañonismo, uno de los recorridos más espectaculares de México." },
  { name: "Mirador de Santiago", description: "La mejor vista panorámica de la Sierra y la Presa, ideal para fotografías al atardecer." }
];

const systemInstruction = `Eres Sergio, guía local de Santiago, N.L. 
Sugiere actividades con entusiasmo y buena onda. 
Recuerda hablar siempre de 'tú'.`;

module.exports = { localActivities, systemInstruction };
