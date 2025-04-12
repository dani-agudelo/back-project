const axios = require("axios");

const getAllPokemon = async (req, res) => {
  try {
    const pokemonList = [];
    const apiUrl = "https://pokeapi.co/api/v2/pokemon?limit=1000";

    // Obtenemos la lista de Pokémon
    const { data } = await axios.get(apiUrl);
    console.log("Pokémon data:", data);

    // Iterar sobre cada Pokémon y obtener sus detalles
    const pokemonDetails = await Promise.all(
      data.results.map(async (pokemon) => {
        const { data: pokemonData } = await axios.get(pokemon.url);
        console.log("Detalles del Pokémon:", pokemonData);

        // Extraemos habilidades y otros datos relevantes
        const abilities = pokemonData.abilities.map((ability) => ({
          name: ability.ability.name,
          url: ability.ability.url,
          is_hidden: ability.is_hidden,
          slot: ability.slot,
        }));

        return {
          id: pokemonData.id,
          name: pokemonData.name,
          abilities,
        };
      })
    );

    pokemonList.push(...pokemonDetails);

    // Responder con la lista de Pokémon
    res.status(200).json({
      message: "Lista de Pokémon: ",
      data: pokemonList,
    });
  } catch (error) {
    console.error("Error al obtener la lista de Pokémon:", error.message);
    res.status(500).json({
      message: "Error al obtener la lista de Pokémon:",
      error: error.message,
    });
  }
};

module.exports = {
  getAllPokemon,
};