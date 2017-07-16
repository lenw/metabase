/**
 * Settings editor for a single database field. Lets you change field type, visibility and display values / remappings.
 *
 * TODO Atte Keinänen 7/6/17: This uses the standard metadata API; we should migrate also other parts of admin section
 */

import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from "react-redux";
import _ from "underscore";

import Icon from 'metabase/components/Icon'
import Input from 'metabase/components/Input'
import Select from 'metabase/components/Select'
import SaveStatus from "metabase/components/SaveStatus";
import ButtonWithStatus from "metabase/components/ButtonWithStatus";

import { getMetadata } from "metabase/selectors/metadata";
import * as metadataActions from "metabase/redux/metadata";
import * as datamodelActions from "../datamodel"
import { isDate } from "metabase/lib/schema_metadata";

import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import Query from "metabase/lib/query";
import SelectButton from "metabase/components/SelectButton";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger";
import FieldList from "metabase/query_builder/components/FieldList";
import {
    FieldVisibilityPicker,
    SpecialTypeAndTargetPicker
} from "metabase/admin/datamodel/components/database/ColumnItem";
import { getDatabaseIdfields } from "metabase/admin/datamodel/selectors";
import Metadata from "metabase-lib/lib/metadata/Metadata";
import Question from "metabase-lib/lib/Question";
import { DatetimeFieldDimension } from "metabase-lib/lib/Dimension";

const SelectClasses = 'h3 bordered border-dark shadowed p2 inline-block flex align-center rounded text-bold'

const mapStateToProps = (state, props) => {
    return {
        databaseId: parseInt(props.params.databaseId),
        tableId: parseInt(props.params.tableId),
        fieldId: parseInt(props.params.fieldId),
        metadata: getMetadata(state),
        idfields: getDatabaseIdfields(state)
    }
}

const mapDispatchToProps = {
    fetchDatabaseMetadata: metadataActions.fetchDatabaseMetadata,
    fetchTableMetadata: metadataActions.fetchTableMetadata,
    updateField: metadataActions.updateField,
    updateFieldValues: metadataActions.updateFieldValues,
    updateFieldDimension: metadataActions.updateFieldDimension,
    deleteFieldDimension: metadataActions.deleteFieldDimension,
    fetchDatabaseIdfields: datamodelActions.fetchDatabaseIdfields
}

@connect(mapStateToProps, mapDispatchToProps)
export default class FieldApp extends Component {
    saveStatus: null

    props: {
        databaseId: number,
        tableId: number,
        fieldId: number,
        metadata: Metadata,
        idfields: Object[],

        fetchDatabaseMetadata: (number) => Promise<void>,
        fetchTableMetadata: (number) => Promise<void>,
        updateField: (any) => Promise<void>,
        updateFieldValues: (any) => Promise<void>,
        updateFieldDimension: (any) => Promise<void>,
        deleteFieldDimension: (any) => Promise<void>,
        fetchDatabaseIdfields: (number) => Promise<void>
    }

    async componentWillMount() {
        const {databaseId, tableId, fetchDatabaseMetadata, fetchTableMetadata, fetchDatabaseIdfields} = this.props;

        // A complete database metadata is needed in case that foreign key is changed
        // and then we need to show FK remapping options for a new table
        await fetchDatabaseMetadata(databaseId);

        // Only fetchTableMetadata hydrates `dimension` in the field object
        // Force reload to ensure that we are not showing stale information
        await fetchTableMetadata(tableId, true);

        // TODO Atte Keinänen 7/10/17: Migrate this to redux/metadata
        await fetchDatabaseIdfields(databaseId);
    }

    linkWithSaveStatus = (saveMethod) => {
        const self = this;
        return async (...params) => {
            self.saveStatus && self.saveStatus.setSaving();
            await saveMethod(...params);
            self.saveStatus && self.saveStatus.setSaved();
        }
    }

    onUpdateField = this.linkWithSaveStatus(this.props.updateField)
    onUpdateFieldProperties = this.linkWithSaveStatus(async (fieldProps) => {
        const { metadata, fieldId } = this.props;
        const field = metadata.fields[fieldId];

        if (field) {
            // `table` and `target` propertes is part of the fully connected metadata graph; drop it because it
            // makes conversion to JSON impossible due to cyclical data structure
            await this.props.updateField({ ...field.getPlainObject(), ...fieldProps });
        } else {
            console.warn("Updating field properties in fields settings failed because of missing field metadata")
        }
    })
    onUpdateFieldValues = this.linkWithSaveStatus(this.props.updateFieldValues)
    onUpdateFieldDimension = this.linkWithSaveStatus(this.props.updateFieldDimension)
    onDeleteFieldDimension = this.linkWithSaveStatus(this.props.deleteFieldDimension)

    render () {
        const {
            metadata,
            fieldId,
            databaseId,
            tableId,
            idfields,
            fetchTableMetadata
        } = this.props;

        const field = metadata.fields[fieldId]
        const table = metadata.tables[tableId]

        const isLoading = !field || !table || !idfields

        return (
            <LoadingAndErrorWrapper loading={isLoading} error={null} noWrapper>
                { () =>
                    <div className="relative">
                        <div className="wrapper wrapper--trim">
                            <BackButton databaseId={databaseId} tableId={tableId} />
                            <div className="absolute top right mt4 mr4">
                                <SaveStatus ref={(ref) => this.saveStatus = ref}/>
                            </div>

                            <Section>
                                <FieldHeader
                                    field={field}
                                    updateFieldProperties={this.onUpdateFieldProperties}
                                />
                            </Section>

                            <Section>
                                <SectionHeader title="Visibility"
                                               description="Where this field will appear throughout Metabase"/>
                                <FieldVisibilityPicker
                                    triggerClasses={SelectClasses}
                                    field={field.getPlainObject()}
                                    updateField={this.onUpdateField}
                                />
                            </Section>

                            <Section>
                                <SectionHeader title="Type" />
                                <SpecialTypeAndTargetPicker
                                    triggerClasses={SelectClasses}
                                    field={field.getPlainObject()}
                                    updateField={this.onUpdateField}
                                    idfields={idfields}
                                    selectSeparator={<SelectSeparator />}
                                />
                            </Section>

                            <Section>
                                <FieldRemapping
                                    field={field}
                                    table={table}
                                    fields={metadata.fields}
                                    updateFieldProperties={this.onUpdateFieldProperties}
                                    updateFieldValues={this.onUpdateFieldValues}
                                    updateFieldDimension={this.onUpdateFieldDimension}
                                    deleteFieldDimension={this.onDeleteFieldDimension}
                                    fetchTableMetadata={fetchTableMetadata}
                                />
                            </Section>
                        </div>
                    </div>
                }
            </LoadingAndErrorWrapper>
        )
    }
}

// TODO: Should this invoke goBack() instead?
// not sure if it's possible to do that neatly with Link component
export const BackButton = ({ databaseId, tableId }) =>
    <Link
        to={`/admin/datamodel/database/${databaseId}/table/${tableId}`}
        className="circle text-white p2 mt3 ml3 flex align-center justify-center  absolute top left"
        style={{ backgroundColor: '#8091AB' }}
    >
        <Icon name="backArrow" />
    </Link>

const SelectSeparator = () =>
    <Icon
        name="chevronright"
        size={12}
        className="mx2 text-grey-3"
    />

export class FieldHeader extends Component {
    onNameChange = (e) => {
        const { updateFieldProperties } = this.props;
        const display_name = e.target.value;
        // todo: how to treat empty / too long strings? see how this is done in Column
        updateFieldProperties({ display_name })
    }

    onDescriptionChange = (e) => {
        const { updateFieldProperties } = this.props
        const description = e.target.value;
        updateFieldProperties({ description })
    }

    render () {
        return (
            <div>
                <Input
                    className="h1 AdminInput bordered rounded border-dark block mb1"
                    value={this.props.field.display_name}
                    onChange={this.onNameChange}
                    placeholder={this.props.field.name}
                />
                <Input
                    className="text AdminInput bordered input text-measure block full"
                    value={this.props.field.description}
                    onChange={this.onDescriptionChange}
                    placeholder="No description for this field yet"
                />
            </div>
        )
}
}

// consider renaming this component to something more descriptive
export class ValueRemappings extends Component {
    constructor(props, context) {
        super(props, context);

        const editingRemappings = new Map([...props.remappings]
            .map(([original, mappedOrUndefined]) => {
                // Use currently the original value as the "default custom mapping" as the current backend implementation
                // requires that all original values must have corresponding mappings

                // Additionally, the defensive `.toString` ensures that the mapped value definitely will be string
                const mappedString =
                    mappedOrUndefined !== undefined ? mappedOrUndefined.toString() : original.toString();

                return [original, mappedString]
            })
        )

        const containsUnsetMappings = [...props.remappings].some(([_, mappedOrUndefined]) => {
            return mappedOrUndefined === undefined;
        })
        if (containsUnsetMappings) {
            // Save the initial values to make sure that we aren't left in a potentially broken state where
            // the dimension type is "internal" but we don't have any values in metabase_fieldvalues
            this.props.updateRemappings(editingRemappings);
        }

        this.state = {
            editingRemappings
        }
    }

    onSetRemapping(original, newMapped) {
        this.setState({
            editingRemappings: new Map([
                ...this.state.editingRemappings,
                [original, newMapped]
            ])
        });
    }

    onSaveClick = () => {
        // Returns the promise so that ButtonWithStatus can show the saving status
        return this.props.updateRemappings(this.state.editingRemappings);
    }

    customValuesAreNonEmpty = () => {
        return Array.from(this.state.editingRemappings.values())
            .every((value) => value !== "")
    }

    render () {
        const { editingRemappings } = this.state;

        return (
            <div className="bordered rounded py2 px4 border-dark">
                <div className="flex align-center my1 pb2 border-bottom">
                    <h3>Original value</h3>
                    <h3 className="ml-auto">Mapped value</h3>
                </div>
                <ol>
                    { [...editingRemappings].map(([original, mapped]) =>
                        <li className="mb1">
                            <FieldValueMapping
                                original={original}
                                mapped={mapped}
                                setMapping={(newMapped) => this.onSetRemapping(original, newMapped) }
                            />
                        </li>
                    )}
                </ol>
                <div className="flex align-center">
                    <ButtonWithStatus
                        className="ml-auto"
                        disabled={!this.customValuesAreNonEmpty()}
                        onClickOperation={this.onSaveClick}
                    >
                        Save
                    </ButtonWithStatus>
                </div>
            </div>
        )
    }
}

export class FieldValueMapping extends Component {
    onInputChange = (e) => {
        this.props.setMapping(e.target.value)
    }

    render () {
        const { original, mapped } = this.props
        return (
            <div className="flex align-center">
                <h3>{original}</h3>
                <Input
                    className="AdminInput input ml-auto"
                    value={mapped}
                    onChange={this.onInputChange}
                    placeholder={"Enter value"}
                />
            </div>
        )
    }
}

const Section = ({ children }) => <section className="my3">{children}</section>

const SectionHeader = ({ title, description }) =>
    <div className="border-bottom py2 mb2">
        <h2 className="text-italic">{title}</h2>
        { description && <p className="mb0 text-grey-4 mt1 text-paragraph text-measure">{description}</p> }
    </div>

const MAP_OPTIONS = {
    original: { type: "original", name: 'Use original value' },
    foreign:  { type: "foreign", name: 'Use foreign key' },
    custom:   { type: "custom", name: 'Custom mapping' }
}

export class FieldRemapping extends Component {

    constructor(props, context) {
        super(props, context);
    }

    componentWillReceiveProps(newProps: Props) {
        const { field } = this.props;

        const shouldResetFKRemappingAfterTargetFieldChange =
            // we already have a fk dimension
            this.getMappingTypeForField(field).type === "foreign" &&
            // the new field's special type is fk and the target field id has changed
            newProps.field.special_type === "type/FK" &&
            newProps.field.fk_target_field_id !== field.fk_target_field_id

        if (shouldResetFKRemappingAfterTargetFieldChange) {
            // Setting the mapping again will reset its FK remapping target field to match the new fk target table
            // TODO: How to get rid of the timeout that is needed for having the new props available?
            setTimeout(() => this.onSetMappingType(MAP_OPTIONS.foreign), 0);
        }
    }

    getMappingTypeForField = (field) => {
        if (_.isEmpty(field.dimensions)) return MAP_OPTIONS.original;
        if (field.dimensions.type === "external") return MAP_OPTIONS.foreign;
        if (field.dimensions.type === "internal") return MAP_OPTIONS.custom;

        throw new Error("Unrecognized mapping type");
    }

    getAvailableMappingTypes = () => {
        const { field } = this.props;

        const hasForeignKeys = field.special_type === "type/FK" && !!field.fk_target_field_id;

        // Only show the "custom" option if we have some values that can be mapped to user-defined custom values
        // (for a field without user-defined remappings, every key of `field.remappings` has value `undefined`)
        const hasMappableNumeralValues =
            field.remapping.size > 0 &&
            [...field.remapping.keys()].every((key) => typeof key === "number" );

        return [
            MAP_OPTIONS.original,
            ...(hasForeignKeys ? [MAP_OPTIONS.foreign] : []),
            ...(hasMappableNumeralValues > 0 ? [MAP_OPTIONS.custom] : [])
        ]
    }

    getFKTargetTableEntityNameOrNull = () => {
        const fks = this.getForeignKeys()
        const fkTargetFields = fks[0] && fks[0].dimensions.map((dim) => dim.field());

        if (fkTargetFields) {
            // TODO Atte Keinänen 7/11/17: Should there be `isName(field)` in Field.js?
            const nameField = fkTargetFields.find((field) => field.special_type === "type/Name")
            return nameField ? nameField.id : null;
        } else {
            throw new Error("Current field isn't a foreign key or FK target table metadata is missing")
        }
    }

    onSetMappingType = async (mappingType) => {
        const { table, field, fetchTableMetadata, updateFieldDimension, deleteFieldDimension } = this.props;

        if (mappingType.type === "original") {
            await deleteFieldDimension(field.id)
        } else if (mappingType.type === "foreign") {
            // Try to find a entity name field from target table and choose it as remapping target field if it exists

            await updateFieldDimension(field.id, {
                type: "external",
                name: field.display_name,
                human_readable_field_id: this.getFKTargetTableEntityNameOrNull()
            })

            await fetchTableMetadata(table.id, true);
        } else if (mappingType.type === "custom") {
            await updateFieldDimension(field.id, {
                type: "internal",
                name: field.display_name,
                human_readable_field_id: null
            })
        } else {
            throw new Error("Unrecognized mapping type");
        }

        // TODO Atte Keinänen 7/11/17: It's a pretty heavy approach to reload the whole table after a single field
        // has been updated; would be nicer to just fetch a single field. MetabaseApi.field_get seems to exist for that
        await fetchTableMetadata(table.id, true);
    }

    onForeignKeyFieldChange = async (foreignKeyClause) => {
        const { table, field, fetchTableMetadata, updateFieldDimension } = this.props;

        // TODO Atte Keinänen 7/10/17: Use Dimension class when migrating to metabase-lib
        if (foreignKeyClause.length === 3 && foreignKeyClause[0] === "fk->") {
            await updateFieldDimension(field.id, {
                type: "external",
                name: field.display_name,
                human_readable_field_id: foreignKeyClause[2]
            })

            await fetchTableMetadata(table.id, true);

            this.refs.fkPopover.close()
        } else {
            throw new Error("The selected field isn't a foreign key")
        }

    }

    onUpdateRemappings = (remappings) => {
        const { field, updateFieldValues } = this.props;
        return updateFieldValues(field.id, Array.from(remappings));
    }

    // TODO Atte Keinänen 7/11/17: Should we have stricter criteria for valid remapping targets?
    isValidFKRemappingTarget = (dimension) => !(dimension.defaultDimension() instanceof DatetimeFieldDimension)

    getForeignKeys = () => {
        const { table, field } = this.props;

        // this method has a little odd structure due to using fieldQuestions(); basically filteredFKs should
        // always be an array with a single value
        const metadata = table.metadata;
        const fieldOptions = Question.create({ metadata, databaseId: table.db.id, tableId: table.id }).query().fieldOptions();
        const unfilteredFks = fieldOptions.fks
        const filteredFKs = unfilteredFks.filter(fk => fk.field.id === field.id);

        return filteredFKs.map(filteredFK => ({
            field: filteredFK.field,
            dimension: filteredFK.dimension,
            dimensions: filteredFK.dimensions.filter(this.isValidFKRemappingTarget)
        }));
    }

    render () {
        const { field, table, fields} = this.props;

        const mappingType = this.getMappingTypeForField(field)
        const isFKMapping = mappingType === MAP_OPTIONS.foreign;
        const hasFKMappingValue = isFKMapping && field.dimensions.human_readable_field_id !== null;
        const fkMappingField = hasFKMappingValue && fields[field.dimensions.human_readable_field_id];

        return (
            <div>
                <SectionHeader
                    title='Display values'
                    description="Choose to show the original value from the database, or have this field display associated or custom information."
                />
                <Select
                    triggerClasses={SelectClasses}
                    value={mappingType}
                    onChange={this.onSetMappingType}
                    options={this.getAvailableMappingTypes()}
                />
                { mappingType === MAP_OPTIONS.foreign && [
                    <SelectSeparator key="foreignKeySeparator" />,
                    <PopoverWithTrigger
                        ref="fkPopover"
                        triggerElement={
                            <SelectButton
                                hasValue={hasFKMappingValue}
                                className="border-dark flex inline-block no-decoration h3 p2 shadowed"
                            >
                                {fkMappingField ? fkMappingField.display_name : "Choose a field"}
                            </SelectButton>
                        }
                        isInitiallyOpen={false}
                    >
                        <FieldList
                            className="text-purple"
                            field={fkMappingField}
                            fieldOptions={{ count: 0, dimensions: [], fks: this.getForeignKeys() }}
                            tableMetadata={table}
                            onFieldChange={this.onForeignKeyFieldChange}
                            hideSectionHeader
                        />
                    </PopoverWithTrigger>
                ]}
                { mappingType === MAP_OPTIONS.custom && (
                    <div className="mt3">
                        <ValueRemappings
                            remappings={field && field.remapping}
                            updateRemappings={this.onUpdateRemappings}
                        />
                    </div>
                )}
            </div>
        )
    }
}

