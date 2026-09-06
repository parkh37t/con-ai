/**
 * 구조화 출력으로 **실제로 보내는 JSON Schema** — 생성물이다. 손으로 고치지 않는다.
 *
 * 왜 파일로 두나: 브라우저(apps/web)는 번들 크기 때문에 Anthropic SDK 를 넣지 않는다. 예전에는 같은 스키마를
 * 손으로 한 벌 더 적었는데, SDK 변환기가 구조화 출력이 받지 않는 것(enum·const·중첩 anyOf)을 설명으로 옮기는
 * 것을 사람이 따라 적을 수 없어 계속 어긋났고 실제 호출이 400 으로 죽었다. 그래서 한 벌만 두고 여기서 만든다.
 *
 * 다시 만들기: `pnpm gen:schema` (wire-schema.ts 를 고치면 반드시 다시 만든다).
 * structured-schema.test.ts 가 이 파일이 현재 wire 스키마와 같은지 매번 확인한다.
 */

export type StructuredJsonSchema = Record<string, unknown>

/** 생성·수정 작업의 모델 출력 전체 (WireOutput 을 structuredVariant 로 바꾼 것). */
export const SCREEN_OUTPUT_JSON_SCHEMA: StructuredJsonSchema = {
  "$defs": {
    "__schema0": {
      "type": "string"
    },
    "__schema1": {
      "type": "string"
    },
    "__schema2": {
      "type": "string"
    },
    "__schema3": {
      "type": "string",
      "description": "미확정 종류 (설계 §8)\n\n{enum: [\"question\",\"assumption\",\"conflict\",\"missing_evidence\"]}"
    },
    "__schema4": {
      "type": "string"
    },
    "__schema5": {
      "type": "string"
    }
  },
  "type": "object",
  "properties": {
    "screen_spec": {
      "type": "object",
      "properties": {
        "schema_version": {
          "type": "string",
          "description": "{const: \"1.0\"}"
        },
        "screen_id": {
          "type": "string"
        },
        "baseline_id": {
          "type": "string"
        },
        "purpose": {
          "type": "string"
        },
        "shell": {
          "type": "string"
        },
        "device": {
          "type": "string",
          "description": "기기 (설계 §2, §9)\n\n{enum: [\"desktop\",\"mobile\"]}"
        },
        "roles": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "criterion_ids": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "criterion_ids"
            ]
          }
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "display_no": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "elements": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "type": {
                      "type": "string",
                      "description": "허용 컴포넌트 (설계 §9)\n\n{enum: [\"text-input\",\"number-input\",\"textarea\",\"select\",\"radio\",\"checkbox\",\"date-input\",\"date-range\",\"button\",\"table\",\"text\",\"link\",\"pagination\"]}"
                    },
                    "label": {
                      "type": "string"
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null"
                      ]
                    },
                    "display_no": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "options": {
                      "anyOf": [
                        {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "value": {
                                "type": "string"
                              },
                              "label": {
                                "type": "string"
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "value",
                              "label"
                            ]
                          }
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "columns": {
                      "anyOf": [
                        {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string"
                              },
                              "label": {
                                "type": "string"
                              },
                              "sortable": {
                                "type": [
                                  "boolean",
                                  "null"
                                ]
                              },
                              "downloadable": {
                                "type": [
                                  "boolean",
                                  "null"
                                ]
                              },
                              "format": {
                                "anyOf": [
                                  {
                                    "type": "string",
                                    "description": "{enum: [\"text\",\"number\",\"date\",\"datetime\",\"currency\",\"status\",\"link\"]}"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "id",
                              "label",
                              "sortable",
                              "downloadable",
                              "format"
                            ]
                          }
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "default_sort": {
                      "anyOf": [
                        {
                          "type": "object",
                          "properties": {
                            "column_id": {
                              "type": "string"
                            },
                            "direction": {
                              "type": "string",
                              "description": "{enum: [\"asc\",\"desc\"]}"
                            }
                          },
                          "additionalProperties": false,
                          "required": [
                            "column_id",
                            "direction"
                          ]
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "max_length": {
                      "anyOf": [
                        {
                          "type": "integer",
                          "description": "{minimum: -9007199254740991, maximum: 9007199254740991}"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "validations": {
                      "anyOf": [
                        {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "rule": {
                                "type": "string",
                                "description": "필드 검증 규칙 (설계 §9)\n\n{enum: [\"required\",\"min_length\",\"max_length\",\"pattern\",\"range\",\"date_range\"]}"
                              },
                              "value": {
                                "type": [
                                  "string",
                                  "number",
                                  "null"
                                ]
                              },
                              "message_id": {
                                "type": [
                                  "string",
                                  "null"
                                ]
                              }
                            },
                            "additionalProperties": false,
                            "required": [
                              "rule",
                              "value",
                              "message_id"
                            ]
                          }
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "trace": {
                      "anyOf": [
                        {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "locked": {
                      "type": [
                        "boolean",
                        "null"
                      ]
                    },
                    "note": {
                      "type": [
                        "string",
                        "null"
                      ]
                    }
                  },
                  "additionalProperties": false,
                  "required": [
                    "id",
                    "type",
                    "label",
                    "required",
                    "display_no",
                    "placeholder",
                    "options",
                    "columns",
                    "default_sort",
                    "max_length",
                    "validations",
                    "trace",
                    "locked",
                    "note"
                  ]
                }
              },
              "note": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "title",
              "display_no",
              "elements",
              "note"
            ]
          }
        },
        "actions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "type": {
                "type": "string",
                "description": "제한된 동작 (설계 §9)\n\n{enum: [\"filter-fixture\",\"sort-fixture\",\"open-popup\",\"close-popup\",\"download-fixture\",\"navigate\",\"set-state\"]}"
              },
              "label": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "trigger": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "target": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "target_screen_id": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "target_state_id": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "trace": {
                "anyOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "note": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "type",
              "label",
              "trigger",
              "target",
              "target_screen_id",
              "target_state_id",
              "trace",
              "note"
            ]
          }
        },
        "states": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "fixture_id": {
                "type": "string"
              },
              "expected": {
                "type": "string"
              },
              "case_kind": {
                "anyOf": [
                  {
                    "type": "string",
                    "description": "CASE 종류 (설계 §8)\n\n{enum: [\"normal\",\"empty\",\"error\",\"permission\",\"processing\"]}"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "role": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "message_ids": {
                "anyOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "note": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "fixture_id",
              "expected",
              "case_kind",
              "role",
              "message_ids",
              "note"
            ]
          }
        },
        "messages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "kind": {
                "type": "string",
                "description": "메시지 종류 (설계 §9)\n\n{enum: [\"info\",\"success\",\"warning\",\"error\",\"confirm\"]}"
              },
              "text": {
                "type": "string"
              },
              "when": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "kind",
              "text",
              "when"
            ]
          }
        },
        "data_mapping": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "element_id": {
                "type": "string"
              },
              "column_id": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "source": {
                "type": "string"
              },
              "evidence": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "anchor_id": {
                      "$ref": "#/$defs/__schema0"
                    },
                    "note": {
                      "anyOf": [
                        {
                          "$ref": "#/$defs/__schema1"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "additionalProperties": false,
                  "required": [
                    "anchor_id",
                    "note"
                  ]
                }
              }
            },
            "additionalProperties": false,
            "required": [
              "element_id",
              "column_id",
              "source",
              "evidence"
            ]
          }
        },
        "locked_elements": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "locked_actions": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "unresolved": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "anyOf": [
                  {
                    "$ref": "#/$defs/__schema2"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "kind": {
                "$ref": "#/$defs/__schema3"
              },
              "text": {
                "$ref": "#/$defs/__schema4"
              },
              "related_ids": {
                "anyOf": [
                  {
                    "type": "array",
                    "items": {
                      "$ref": "#/$defs/__schema5"
                    }
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "additionalProperties": false,
            "required": [
              "id",
              "kind",
              "text",
              "related_ids"
            ]
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "schema_version",
        "screen_id",
        "baseline_id",
        "purpose",
        "shell",
        "device",
        "roles",
        "requirements",
        "sections",
        "actions",
        "states",
        "messages",
        "data_mapping",
        "locked_elements",
        "locked_actions",
        "unresolved"
      ]
    },
    "trace_proposals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requirement_id": {
            "type": "string"
          },
          "criterion_id": {
            "type": "string"
          },
          "element_or_action_id": {
            "type": "string"
          },
          "evidence": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "anchor_id": {
                      "$ref": "#/$defs/__schema0"
                    },
                    "note": {
                      "anyOf": [
                        {
                          "$ref": "#/$defs/__schema1"
                        },
                        {
                          "type": "null"
                        }
                      ]
                    }
                  },
                  "additionalProperties": false,
                  "required": [
                    "anchor_id",
                    "note"
                  ]
                }
              },
              {
                "type": "null"
              }
            ]
          },
          "rationale": {
            "type": [
              "string",
              "null"
            ]
          },
          "confidence": {
            "type": [
              "number",
              "null"
            ]
          }
        },
        "additionalProperties": false,
        "required": [
          "requirement_id",
          "criterion_id",
          "element_or_action_id",
          "evidence",
          "rationale",
          "confidence"
        ]
      }
    },
    "unresolved": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "anyOf": [
              {
                "$ref": "#/$defs/__schema2"
              },
              {
                "type": "null"
              }
            ]
          },
          "kind": {
            "$ref": "#/$defs/__schema3"
          },
          "text": {
            "$ref": "#/$defs/__schema4"
          },
          "related_ids": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "$ref": "#/$defs/__schema5"
                }
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false,
        "required": [
          "id",
          "kind",
          "text",
          "related_ids"
        ]
      }
    },
    "change_summary": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string"
        },
        "added_ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "changed_ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "removed_ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "locked_violations": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "required": [
        "summary",
        "added_ids",
        "changed_ids",
        "removed_ids",
        "locked_violations"
      ]
    }
  },
  "additionalProperties": false,
  "required": [
    "screen_spec",
    "trace_proposals",
    "unresolved",
    "change_summary"
  ],
  "description": "{$schema: \"https://json-schema.org/draft/2020-12/schema\"}"
}

/** 코멘트 → 수정 지시문 초안 (WireRevisionDraft). */
export const REVISION_DRAFT_JSON_SCHEMA: StructuredJsonSchema = {
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string"
    },
    "rationale": {
      "type": "string"
    }
  },
  "additionalProperties": false,
  "required": [
    "prompt",
    "rationale"
  ],
  "description": "{$schema: \"https://json-schema.org/draft/2020-12/schema\"}"
}
