package constants

import (
	"embed"
	"encoding/json"
)

//go:embed data/common/*.json data/incorporation/*.json data/trademark/*.json
var dataFS embed.FS

func load(path string, target interface{}) error {
	data, err := dataFS.ReadFile("data/" + path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

// Common
func EntityTypes() (map[string]string, error) { var m map[string]string; return m, load("common/entity-types.json", &m) }

// Incorporation
func IncorporationStates() ([]string, error)           { var s []string; return s, load("incorporation/states.json", &s) }
func CompanyStatuses() (map[string]string, error)      { var m map[string]string; return m, load("incorporation/company-statuses.json", &m) }
func DirectorDesignations() (map[string]string, error) { var m map[string]string; return m, load("incorporation/director-designations.json", &m) }
func McaDefaults() (map[string]string, error)          { var m map[string]string; return m, load("incorporation/mca-defaults.json", &m) }

// Trademark
func TrademarkStatuses() (map[string]string, error)       { var m map[string]string; return m, load("trademark/trademark-statuses.json", &m) }
func TrademarkStateDistricts() (map[string][]string, error) { var m map[string][]string; return m, load("trademark/state-districts.json", &m) }
