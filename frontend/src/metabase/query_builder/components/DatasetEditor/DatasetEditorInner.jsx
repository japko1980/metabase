import { useDisclosure } from "@mantine/hooks";
import cx from "classnames";
import { merge } from "icepick";
import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMount, usePrevious } from "react-use";
import { t } from "ttag";

import { useListModelIndexesQuery } from "metabase/api";
import ActionButton from "metabase/common/components/ActionButton";
import Button from "metabase/common/components/Button";
import DebouncedFrame from "metabase/common/components/DebouncedFrame";
import EditBar from "metabase/common/components/EditBar";
import { LeaveConfirmModal } from "metabase/common/components/LeaveConfirmModal";
import { useToggle } from "metabase/common/hooks/use-toggle";
import ButtonsS from "metabase/css/components/buttons.module.css";
import CS from "metabase/css/core/index.css";
import { connect } from "metabase/lib/redux";
import { getSemanticTypeIcon } from "metabase/lib/schema_metadata";
import { setDatasetEditorTab } from "metabase/query_builder/actions";
import { calcInitialEditorHeight } from "metabase/query_builder/components/NativeQueryEditor/utils";
import QueryVisualization from "metabase/query_builder/components/QueryVisualization";
import DataReference from "metabase/query_builder/components/dataref/DataReference";
import { SnippetSidebar } from "metabase/query_builder/components/template_tags/SnippetSidebar/SnippetSidebar";
import { TagEditorSidebar } from "metabase/query_builder/components/template_tags/TagEditorSidebar";
import ViewSidebar from "metabase/query_builder/components/view/ViewSidebar";
import { MODAL_TYPES } from "metabase/query_builder/constants";
import {
  getDatasetEditorTab,
  getIsResultDirty,
  getMetadataDiff,
  getResultsMetadata,
  getVisualizationSettings,
  isResultsMetadataDirty,
} from "metabase/query_builder/selectors";
import { getWritableColumnProperties } from "metabase/query_builder/utils";
import { getMetadata } from "metabase/selectors/metadata";
import { Box, Flex, Icon, Tooltip } from "metabase/ui";
import * as Lib from "metabase-lib";
import {
  checkCanBeModel,
  getSortedModelFields,
} from "metabase-lib/v1/metadata/utils/models";

import DatasetEditorS from "./DatasetEditor.module.css";
import DatasetFieldMetadataSidebar from "./DatasetFieldMetadataSidebar";
import DatasetQueryEditor from "./DatasetQueryEditor";
import { EditorTabs } from "./EditorTabs";
import { TabHintToast } from "./TabHintToast";
import { EDITOR_TAB_INDEXES } from "./constants";

const propTypes = {
  question: PropTypes.object.isRequired,
  visualizationSettings: PropTypes.object,
  datasetEditorTab: PropTypes.oneOf(["query", "metadata"]).isRequired,
  metadata: PropTypes.object,
  metadataDiff: PropTypes.object.isRequired,
  resultsMetadata: PropTypes.shape({ columns: PropTypes.array }),
  isMetadataDirty: PropTypes.bool.isRequired,
  result: PropTypes.object,
  height: PropTypes.number,
  isDirty: PropTypes.bool.isRequired,
  isResultDirty: PropTypes.bool.isRequired,
  isRunning: PropTypes.bool.isRequired,
  setQueryBuilderMode: PropTypes.func.isRequired,
  runDirtyQuestionQuery: PropTypes.func.isRequired,
  setDatasetEditorTab: PropTypes.func.isRequired,
  setMetadataDiff: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancelCreateNewModel: PropTypes.func.isRequired,
  cancelQuestionChanges: PropTypes.func.isRequired,
  handleResize: PropTypes.func.isRequired,
  updateQuestion: PropTypes.func.isRequired,
  runQuestionQuery: PropTypes.func.isRequired,
  onOpenModal: PropTypes.func.isRequired,

  // Native editor sidebars
  isShowingTemplateTagsEditor: PropTypes.bool.isRequired,
  isShowingDataReference: PropTypes.bool.isRequired,
  isShowingSnippetSidebar: PropTypes.bool.isRequired,
  toggleTemplateTagsEditor: PropTypes.func.isRequired,
  toggleDataReference: PropTypes.func.isRequired,
  toggleSnippetSidebar: PropTypes.func.isRequired,
  forwardedRef: PropTypes.oneOf([PropTypes.func, PropTypes.object]),
};

const INITIAL_NOTEBOOK_EDITOR_HEIGHT = 500;
const TABLE_HEADER_HEIGHT = 45;

function mapStateToProps(state) {
  return {
    metadata: getMetadata(state),
    metadataDiff: getMetadataDiff(state),
    visualizationSettings: getVisualizationSettings(state),
    datasetEditorTab: getDatasetEditorTab(state),
    isMetadataDirty: isResultsMetadataDirty(state),
    resultsMetadata: getResultsMetadata(state),
    isResultDirty: getIsResultDirty(state),
  };
}

const mapDispatchToProps = { setDatasetEditorTab };

function getSidebar(
  props,
  {
    datasetEditorTab,
    isQueryError,
    focusedField,
    focusedFieldIndex,
    focusFirstField,
    onFieldMetadataChange,
    onMappedDatabaseColumnChange,
  },
) {
  const {
    question,
    isShowingTemplateTagsEditor,
    isShowingDataReference,
    isShowingSnippetSidebar,
    toggleTemplateTagsEditor,
    toggleDataReference,
    toggleSnippetSidebar,
    modelIndexes,
  } = props;

  if (datasetEditorTab === "metadata") {
    if (isQueryError) {
      return null;
    }
    if (!focusedField) {
      // Returning a div, so the sidebar is visible while the data is loading.
      // The field metadata sidebar will appear with an animation once a query completes
      return <div />;
    }
    const isLastField =
      focusedFieldIndex === question.getResultMetadata().length - 1;
    return (
      <DatasetFieldMetadataSidebar
        dataset={question}
        field={focusedField}
        isLastField={isLastField}
        handleFirstFieldFocus={focusFirstField}
        onFieldMetadataChange={onFieldMetadataChange}
        onMappedDatabaseColumnChange={onMappedDatabaseColumnChange}
        modelIndexes={modelIndexes}
      />
    );
  }

  const { isNative } = Lib.queryDisplayInfo(question.query());

  if (!isNative) {
    return null;
  }

  if (isShowingTemplateTagsEditor) {
    return (
      <TagEditorSidebar
        {...props}
        query={question.legacyNativeQuery()}
        onClose={toggleTemplateTagsEditor}
      />
    );
  }
  if (isShowingDataReference) {
    return <DataReference {...props} onClose={toggleDataReference} />;
  }
  if (isShowingSnippetSidebar) {
    return <SnippetSidebar {...props} onClose={toggleSnippetSidebar} />;
  }

  return null;
}

function getColumnTabIndex(columnIndex, focusedFieldIndex) {
  return columnIndex === focusedFieldIndex
    ? EDITOR_TAB_INDEXES.FOCUSED_FIELD
    : columnIndex > focusedFieldIndex
      ? EDITOR_TAB_INDEXES.NEXT_FIELDS
      : EDITOR_TAB_INDEXES.PREVIOUS_FIELDS;
}

const _DatasetEditorInner = (props) => {
  const {
    question,
    visualizationSettings,
    datasetEditorTab,
    result,
    resultsMetadata,
    metadata,
    metadataDiff,
    isMetadataDirty,
    height,
    isDirty: isModelQueryDirty,
    isResultDirty,
    setQueryBuilderMode,
    runDirtyQuestionQuery,
    runQuestionQuery,
    setDatasetEditorTab,
    setMetadataDiff,
    cancelQuestionChanges,
    onCancelCreateNewModel,
    onSave,
    updateQuestion,
    handleResize,
    onOpenModal,
  } = props;

  const { isNative, isEditable } = Lib.queryDisplayInfo(question.query());
  const isDirty = isModelQueryDirty || isMetadataDirty;
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure();
  const fields = useMemo(
    () =>
      getSortedModelFields(
        resultsMetadata?.columns ?? [],
        visualizationSettings ?? {},
      ),
    [resultsMetadata, visualizationSettings],
  );

  const { data: modelIndexes } = useListModelIndexesQuery(
    {
      model_id: question.id(),
    },
    {
      skip: !question.isSaved() || question.type() !== "model",
    },
  );

  const isEditingQuery = datasetEditorTab === "query";
  const isEditingMetadata = datasetEditorTab === "metadata";

  const initialEditorHeight = useMemo(() => {
    const { isNative } = Lib.queryDisplayInfo(question.query());

    if (!isNative) {
      return INITIAL_NOTEBOOK_EDITOR_HEIGHT;
    }
    return calcInitialEditorHeight({
      query: question.legacyNativeQuery(),
      viewHeight: height,
    });
  }, [question, height]);

  const [editorHeight, setEditorHeight] = useState(initialEditorHeight);

  const [focusedFieldName, setFocusedFieldName] = useState();

  useMount(() => {
    if (question.isSaved() && Lib.canRun(question.query(), question.type())) {
      runQuestionQuery();
    }
  });

  const focusedFieldIndex = useMemo(() => {
    if (!focusedFieldName) {
      return -1;
    }
    return fields.findIndex((field) => field.name === focusedFieldName);
  }, [focusedFieldName, fields]);

  const previousFocusedFieldIndex = usePrevious(focusedFieldIndex);

  const focusedField = fields[focusedFieldIndex];

  const focusFirstField = useCallback(() => {
    const [firstField] = fields;
    setFocusedFieldName(firstField?.name);
  }, [fields, setFocusedFieldName]);

  useEffect(() => {
    // Focused field has to be set once the query is completed and the result is rendered
    // Visualization render can remove the focus
    const hasQueryResults = !!result;
    if (!focusedField && hasQueryResults && !result.error) {
      focusFirstField();
    }
  }, [result, focusedFieldName, fields, focusFirstField, focusedField]);

  const inheritMappedFieldProperties = useCallback(
    (changes) => {
      const mappedField = metadata.field?.(changes.id)?.getPlainObject();
      const inheritedProperties =
        mappedField && getWritableColumnProperties(mappedField);
      return mappedField ? merge(inheritedProperties, changes) : changes;
    },
    [metadata],
  );

  const onFieldMetadataChange = useCallback(
    (values) => {
      setMetadataDiff({ name: focusedFieldName, changes: values });
    },
    [focusedFieldName, setMetadataDiff],
  );

  const onMappedDatabaseColumnChange = useCallback(
    (value) => {
      const changes = inheritMappedFieldProperties({ id: value });
      setMetadataDiff({ name: focusedFieldName, changes });
    },
    [focusedFieldName, setMetadataDiff, inheritMappedFieldProperties],
  );

  const [isTabHintVisible, { turnOn: showTabHint, turnOff: hideTabHint }] =
    useToggle(false);

  useEffect(() => {
    let timeoutId;
    if (result) {
      timeoutId = setTimeout(() => showTabHint(), 500);
    }
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const onChangeEditorTab = useCallback(
    (tab) => {
      setDatasetEditorTab(tab);
      setEditorHeight(tab === "query" ? initialEditorHeight : 0);
    },
    [initialEditorHeight, setDatasetEditorTab],
  );

  const handleCancelEdit = () => {
    closeModal();
    cancelQuestionChanges();
    setQueryBuilderMode("view");
    runDirtyQuestionQuery();
  };

  const handleCancelClick = () => {
    if (question.isSaved()) {
      if (isDirty) {
        openModal();
      } else {
        handleCancelEdit();
      }
    } else {
      onCancelCreateNewModel();
    }
  };

  const handleSave = useCallback(async () => {
    const canBeDataset = checkCanBeModel(question);
    const isBrandNewDataset = !question.id();
    const questionWithMetadata = question.setResultMetadataDiff(metadataDiff);

    if (canBeDataset && isBrandNewDataset) {
      await updateQuestion(questionWithMetadata, { rerunQuery: false });
      onOpenModal(MODAL_TYPES.SAVE);
    } else if (canBeDataset) {
      await onSave(questionWithMetadata, { rerunQuery: true });
      await setQueryBuilderMode("view");
      runQuestionQuery();
    } else {
      onOpenModal(MODAL_TYPES.CAN_NOT_CREATE_MODEL);
      throw new Error(t`Variables in models aren't supported yet`);
    }
  }, [
    question,
    metadataDiff,
    updateQuestion,
    onSave,
    setQueryBuilderMode,
    runQuestionQuery,
    onOpenModal,
  ]);

  const handleColumnSelect = useCallback(
    (column) => {
      setFocusedFieldName(column.name);
    },
    [setFocusedFieldName],
  );

  const handleTableElementClick = useCallback(
    ({ element, ...clickedObject }) => {
      const isColumnClick =
        clickedObject?.column && Object.keys(clickedObject)?.length === 1;

      if (isColumnClick) {
        setFocusedFieldName(clickedObject.column.name);
      }
    },
    [setFocusedFieldName],
  );

  const handleHeaderColumnReorder = useCallback(
    (dragColIndex) => {
      const field = fields[dragColIndex];

      if (!field) {
        return;
      }

      setFocusedFieldName(field.name);
    },
    [fields],
  );

  // This value together with focusedFieldIndex is used to
  // horizontally scroll the InteractiveTable to the focused column
  // (via react-virtualized's "scrollToColumn" prop)
  const scrollToColumnModifier = useMemo(() => {
    // Normally the modifier is either 1 or -1 and added to focusedFieldIndex,
    // so it's either the previous or the next column is visible
    // (depending on if we're tabbing forward or backwards)
    // But when the first field is selected, it's important to keep "scrollToColumn" 0
    // So when you hit "Tab" while the very last column is focused,
    // it'd jump exactly to the beginning of the table
    if (focusedFieldIndex === 0) {
      return 0;
    }
    const isGoingForward = focusedFieldIndex >= previousFocusedFieldIndex;
    return isGoingForward ? 1 : -1;
  }, [focusedFieldIndex, previousFocusedFieldIndex]);

  const renderSelectableTableColumnHeader = useCallback(
    (column, columnIndex) => {
      const isSelected = columnIndex === focusedFieldIndex;
      return (
        <Flex
          className={cx(DatasetEditorS.TableHeaderColumnName, {
            [DatasetEditorS.isSelected]: isSelected,
          })}
          tabIndex={getColumnTabIndex(columnIndex, focusedFieldIndex)}
          onFocus={() => handleColumnSelect(column)}
          data-testid="model-column-header-content"
        >
          <Icon
            className={cx(DatasetEditorS.FieldTypeIcon, {
              [DatasetEditorS.isSelected]: isSelected,
            })}
            size={14}
            name={getSemanticTypeIcon(column.semantic_type, "ellipsis")}
          />
          <span>{column.display_name}</span>
        </Flex>
      );
    },
    [focusedFieldIndex, handleColumnSelect],
  );

  const renderTableHeader = useMemo(
    () =>
      datasetEditorTab === "metadata"
        ? renderSelectableTableColumnHeader
        : undefined,
    [datasetEditorTab, renderSelectableTableColumnHeader],
  );

  const canSaveChanges =
    isDirty &&
    (!isNative || !isResultDirty) &&
    fields.every((field) => field.display_name) &&
    Lib.canSave(question.query(), question.type());

  const saveButtonTooltipLabel = useMemo(() => {
    if (
      isNative &&
      isDirty &&
      isResultDirty &&
      Lib.rawNativeQuery(question.query()).length > 0
    ) {
      return t`You must run the query before you can save this model`;
    }
  }, [isNative, isDirty, isResultDirty, question]);

  const sidebar = getSidebar(
    { ...props, modelIndexes },
    {
      datasetEditorTab,
      isQueryError: result?.error,
      focusedField,
      focusedFieldIndex,
      focusFirstField,
      onFieldMetadataChange,
      onMappedDatabaseColumnChange,
    },
  );

  return (
    <>
      <EditBar
        className={DatasetEditorS.DatasetEditBar}
        data-testid="dataset-edit-bar"
        title={question.displayName()}
        center={
          <EditorTabs
            currentTab={datasetEditorTab}
            disabledQuery={!isEditable}
            disabledMetadata={!resultsMetadata}
            onChange={onChangeEditorTab}
          />
        }
        buttons={[
          <Button
            key="cancel"
            small
            onClick={handleCancelClick}
          >{t`Cancel`}</Button>,
          <Tooltip
            key="save"
            refProp="innerRef"
            label={saveButtonTooltipLabel}
            disabled={!saveButtonTooltipLabel}
          >
            <ActionButton
              key="save"
              disabled={!canSaveChanges}
              actionFn={handleSave}
              normalText={question.isSaved() ? t`Save changes` : t`Save`}
              activeText={t`Saving…`}
              failedText={t`Save failed`}
              successText={t`Saved`}
              className={cx(
                ButtonsS.Button,
                ButtonsS.ButtonPrimary,
                ButtonsS.ButtonSmall,
              )}
            />
          </Tooltip>,
        ]}
      />
      <Flex className={DatasetEditorS.Root} ref={props.forwardedRef}>
        <Flex className={DatasetEditorS.MainContainer}>
          <Box
            className={cx(DatasetEditorS.QueryEditorContainer, {
              [DatasetEditorS.isResizable]: isEditingQuery,
            })}
          >
            {/**
             * Optimization: DatasetQueryEditor can be expensive to re-render
             * and we don't need it on the "Metadata" tab.
             *
             * @see https://github.com/metabase/metabase/pull/31142/files#r1211352364
             */}
            {isEditingQuery && editorHeight > 0 && (
              <DatasetQueryEditor
                {...props}
                isActive={isEditingQuery}
                height={editorHeight}
                viewHeight={height}
                onResizeStop={handleResize}
              />
            )}
          </Box>
          <Box
            className={cx(DatasetEditorS.TableContainer, {
              [DatasetEditorS.isSidebarOpen]: sidebar,
            })}
          >
            <DebouncedFrame className={cx(CS.flexFull)} enabled>
              <QueryVisualization
                {...props}
                className={CS.spread}
                noHeader
                queryBuilderMode="dataset"
                onHeaderColumnReorder={handleHeaderColumnReorder}
                isShowingDetailsOnlyColumns={datasetEditorTab === "metadata"}
                hasMetadataPopovers={false}
                handleVisualizationClick={handleTableElementClick}
                tableHeaderHeight={isEditingMetadata && TABLE_HEADER_HEIGHT}
                renderTableHeader={renderTableHeader}
                scrollToColumn={focusedFieldIndex + scrollToColumnModifier}
                renderEmptyMessage={isEditingMetadata}
              />
            </DebouncedFrame>
            <Box
              className={cx(DatasetEditorS.TabHintToastContainer, {
                [DatasetEditorS.isVisible]:
                  isEditingMetadata && isTabHintVisible && !result.error,
              })}
            >
              <TabHintToast onClose={hideTabHint} />
            </Box>
          </Box>
        </Flex>
        <ViewSidebar side="right" isOpen={!!sidebar}>
          {sidebar}
        </ViewSidebar>
      </Flex>

      <LeaveConfirmModal
        opened={modalOpened}
        onConfirm={handleCancelEdit}
        onClose={closeModal}
      />
    </>
  );
};

_DatasetEditorInner.propTypes = propTypes;

export const DatasetEditorInner = connect(
  mapStateToProps,
  mapDispatchToProps,
  null,
  { forwardRef: true },
)(_DatasetEditorInner);
