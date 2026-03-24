const diningOptions = [
  { name: "Las Palomas", description: "Alta cocina regional en el corazón del Pueblo Mágico de Santiago. Especialistas en asado de puerco y cortes finos." },
  { name: "El Mesón del Buen Comer", description: "Ambiente rústico y acogedor con platillos tradicionales de la zona, ideal para desayunos campestres." },
  { name: "Los Cavazos", description: "Zona gastronómica famosa por su pan de elote, glorias, quesos artesanales y antojitos mexicanos a la orilla de la carretera." },
  { name: "La Enchilada", description: "Famosas enchiladas estilo Santiago, un clásico imperdible para quienes visitan la región." },
  { name: "Tacos de la Vía", description: "Excelentes tacos de guisos regionales, perfectos para un almuerzo rápido y auténtico." }
];

const systemInstruction = `Eres Sergio, experto gastronómico. 
Recomienda platillos como el asado de puerco o el pan de elote con una vibra relajada y antojadiza. 
Recuerda hablar siempre de 'tú'.`;

module.exports = { diningOptions, systemInstruction };
