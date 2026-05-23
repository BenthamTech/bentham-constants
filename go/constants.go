package constants

import (
	"embed"
	"encoding/json"
)

//go:embed ../data/*.json
var dataFS embed.FS

func load(filename string, target interface{}) error {
	data, err := dataFS.ReadFile("../data/" + filename)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func States() (map[string]string, error) {
	var m map[string]string
	return m, load("states.json", &m)
}

func CompanyStatuses() (map[string]string, error) {
	var m map[string]string
	return m, load("company-statuses.json", &m)
}

func TrademarkStatuses() (map[string]string, error) {
	var m map[string]string
	return m, load("trademark-statuses.json", &m)
}

func EntityTypes() (map[string]string, error) {
	var m map[string]string
	return m, load("entity-types.json", &m)
}

func DirectorDesignations() (map[string]string, error) {
	var m map[string]string
	return m, load("director-designations.json", &m)
}

func McaDefaults() (map[string]string, error) {
	var m map[string]string
	return m, load("mca-defaults.json", &m)
}
