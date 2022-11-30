require('file-loader?name=[name].[ext]!../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
const AS = require('./models/AS');
const MovieCast = require('./models/MovieCast');
const _ = require('lodash');

const neo4j = window.neo4j;
const neo4jUri = process.env.NEO4J_URI;
let neo4jVersion = process.env.NEO4J_VERSION;
if (neo4jVersion === '') {
  // assume Neo4j 4 by default
  neo4jVersion = '4';
}
let database = process.env.NEO4J_DATABASE;
if (!neo4jVersion.startsWith("4")) {
  database = null;
}
const driver = neo4j.driver(
    neo4jUri,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

console.log(`Database running at ${neo4jUri}`)

function searchAS(searchString) {
  const session = driver.session({database: database});
  const searchInt = Number(searchString)
    console.log(searchString)
  return session.readTransaction((tx) =>
      //tx.run('MATCH (as:AS)-[:NAME]-(n:NAME) \
      //WHERE toLower(n.name) CONTAINS toLower($searchString) OR \
      tx.run('MATCH (as:AS {asn:$searchInt}) RETURN as', {searchInt}) 
      //WHERE as.asn = $searchInt \
      //RETURN as',
      //{searchInt})
    )
    .then(result => {
        console.log('results')
        console.log(result)
      return result.records.map(record => {
        return new AS(record.get('as'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function getAS(asn) {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
      tx.run("MATCH (as:AS {asn:$asn}) \
      OPTIONAL MATCH (as)-[r:ANNOUNCE]-(prefix:PREFIX) \
      RETURN as.asn AS asn, \
      collect([prefix.prefix, prefix.af]) AS prefixes \
      LIMIT 1", {asn}))
    .then(result => {
      if (_.isEmpty(result.records))
        return null;

      const record = result.records[0];
      return new MovieCast(record.get('asn'), record.get('cast'));
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function voteInMovie(title) {
  const session = driver.session({ database: database });
  return session.writeTransaction((tx) =>
      tx.run("MATCH (m:Movie {title: $title}) \
        SET m.votes = coalesce(m.votes, 0) + 1", { title }))
    .then(result => {
      return result.summary.counters.updates().propertiesSet
    })
    .finally(() => {
      return session.close();
    });
}

function getGraph() {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
    tx.run('MATCH (m:Movie)<-[:ACTED_IN]-(a:Person) \
    RETURN m.title AS movie, collect(a.name) AS cast \
    LIMIT $limit', {limit: neo4j.int(100)}))
    .then(results => {
      const nodes = [], rels = [];
      let i = 0;
      results.records.forEach(res => {
        nodes.push({title: res.get('movie'), label: 'movie'});
        const target = i;
        i++;

        res.get('cast').forEach(name => {
          const actor = {title: name, label: 'actor'};
          let source = _.findIndex(nodes, actor);
          if (source === -1) {
            nodes.push(actor);
            source = i;
            i++;
          }
          rels.push({source, target})
        })
      });

      return {nodes, links: rels};
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

exports.searchAS = searchAS;
exports.getAS = getAS;
exports.getGraph = getGraph;
exports.voteInMovie = voteInMovie;

