import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LibraryLayout } from '../../lib/libraryView';
import { MtgCard } from '../../lib/mtgCards';
import { ChecklistEntry, ColorCount, ManaColor, SetSummary } from '../../lib/mtgOverview';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ChevronIcon } from '../icons';
import { MtgCardImage } from '../MtgCardImage';
import { ManaSymbolRow, MtgCollectionOverview } from '../MtgCollectionOverview';

type CollectionScreen = 'overview' | 'set' | 'all';

type MtgCollectionResultsProps = {
  cards: MtgCard[];
  entries: ChecklistEntry<MtgCard>[];
  screen: CollectionScreen;
  writer: boolean;
  layout: LibraryLayout;
  compact: boolean;
  colorCounts: ColorCount[] | null;
  copies: number;
  printings: number;
  setCount: number;
  sets: SetSummary[];
  filtering: boolean;
  onOpenSet: (code: string) => void;
  onOpenAll: () => void;
  selectedColor: ManaColor | null;
  onSelectColor: (color: ManaColor) => void;
  onAddFinish?: (scryfallId: string, foil: boolean) => void;
  onAdjustFinish?: (card: MtgCard, delta: number) => void;
  canAdjustFinish?: (card: MtgCard) => boolean;
  addingFinish?: { scryfallId: string; foil: boolean } | null;
  emptyAction?: { label: string; onPress: () => void };
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

function finishCopy(qty: number, foil: boolean, adding: boolean, canAdd: boolean): string {
  if (adding) return foil ? '★ Adding…' : 'Adding…';
  if (qty > 0) return foil ? `★ ${qty}` : String(qty);
  if (canAdd) return foil ? '★ Add' : 'Add';
  return foil ? '★ 0' : '0';
}

function finishAccessibility(name: string, qty: number, foil: boolean, adding: boolean, canAdd: boolean): string {
  const finish = foil ? 'foil' : 'non-foil';
  if (adding) return `${name}, ${finish}, adding`;
  if (qty > 0) return `${name}, ${finish}, ${qty}`;
  if (canAdd) return `${name}, ${finish}, not owned, add`;
  return `${name}, ${finish}, not owned`;
}

function SetFinishStepper({
  name,
  card,
  foil,
  busy,
  editable,
  canAdd,
  onAdd,
  onAdjust,
}: {
  name: string;
  card: MtgCard | null;
  foil: boolean;
  busy: boolean;
  editable: boolean;
  canAdd: boolean;
  onAdd?: () => void;
  onAdjust?: (card: MtgCard, delta: number) => void;
}) {
  const { colors } = useTheme();
  const qty = card?.qty ?? 0;
  const finish = foil ? 'foil' : 'non-foil';
  const label = foil ? 'Foil' : 'Non-foil';
  const countColor = qty > 0 ? colors.textSecondary : colors.textTertiary;
  const showControls = editable || canAdd;
  const minusDisabled = busy || !editable || qty < 1;
  const plusDisabled = busy || (!editable && !canAdd);

  return (
    <View style={styles.stepperHalf} accessibilityLabel={showControls ? undefined : `${name}, ${finish}, ${qty}`}>
      <Text style={[styles.stepperLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.stepperControls}>
        {showControls ? (
          <Pressable
            onPress={() => {
              if (card && editable) onAdjust?.(card, -1);
            }}
            disabled={minusDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${finish} ${name}`}
            accessibilityState={{ disabled: minusDisabled }}
            hitSlop={4}
            style={styles.stepperButton}
          >
            <Text style={[styles.stepperSign, { color: minusDisabled ? colors.textTertiary : colors.accent }]}>−</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.stepperCount, { color: countColor }]} accessibilityLabel={`${qty} ${finish}`}>
          {qty}
        </Text>
        {showControls ? (
          <Pressable
            onPress={() => {
              if (card && editable) onAdjust?.(card, 1);
              else onAdd?.();
            }}
            disabled={plusDisabled}
            accessibilityRole="button"
            accessibilityLabel={editable ? `Increase ${finish} ${name}` : `Add ${finish} ${name}`}
            accessibilityState={{ disabled: plusDisabled }}
            hitSlop={4}
            style={styles.stepperButton}
          >
            <Text style={[styles.stepperSign, { color: plusDisabled ? colors.textTertiary : colors.accent }]}>+</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function FinishCount({
  name,
  qty,
  foil,
  adding,
  canAdd,
  color,
  onOpen,
  onAdd,
  cardId,
  scryfallId,
}: {
  name: string;
  qty: number;
  foil: boolean;
  adding: boolean;
  canAdd: boolean;
  color: string;
  onOpen: (id: string) => void;
  onAdd?: (scryfallId: string, foil: boolean) => void;
  cardId: string | null;
  scryfallId: string;
}) {
  const label = finishCopy(qty, foil, adding, canAdd);
  const accessibilityLabel = finishAccessibility(name, qty, foil, adding, canAdd);
  const onPress =
    qty > 0 && cardId
      ? () => onOpen(cardId)
      : qty === 0 && canAdd && onAdd && !adding
        ? () => onAdd(scryfallId, foil)
        : undefined;

  if (!onPress) {
    return (
      <Text style={[typeScale.caption, { color }]} accessibilityLabel={accessibilityLabel}>
        {label}
      </Text>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={8}>
      <Text style={[typeScale.caption, { color }]}>{label}</Text>
    </Pressable>
  );
}

function ChecklistRow({
  entry,
  layout,
  compact,
  writer,
  addingFinish,
  offerUnowned,
  onOpen,
  onAdd,
  onAdjust,
  canAdjust,
}: {
  entry: ChecklistEntry<MtgCard>;
  layout: LibraryLayout;
  compact: boolean;
  writer: boolean;
  addingFinish: { scryfallId: string; foil: boolean } | null;
  /** Set checklist can add the finish you do not own. All cards only shows owned counts. */
  offerUnowned: boolean;
  onOpen: (id: string) => void;
  onAdd?: (scryfallId: string, foil: boolean) => void;
  onAdjust?: (card: MtgCard, delta: number) => void;
  canAdjust?: (card: MtgCard) => boolean;
}) {
  const { colors } = useTheme();
  const single = entry.kind === 'owned' ? entry.card : null;
  const missing = entry.kind === 'missing';
  const printing = entry.kind === 'printing' ? entry : null;
  const nonfoil = printing?.nonfoil ?? null;
  const foilCard = printing?.foil ?? null;
  const scryfallId = missing ? entry.slot.scryfallId : nonfoil?.scryfallId ?? foilCard?.scryfallId ?? single?.scryfallId ?? '';
  const name = missing ? entry.slot.name : nonfoil?.name ?? foilCard?.name ?? single?.name ?? '';
  const imageUri = missing ? entry.slot.imageUri : nonfoil?.imageUri ?? foilCard?.imageUri ?? single?.imageUri ?? null;
  const backUri = missing ? entry.slot.backImageUri : nonfoil?.backImageUri ?? foilCard?.backImageUri ?? single?.backImageUri ?? null;
  const setCode = missing ? entry.slot.setCode : nonfoil?.setCode ?? foilCard?.setCode ?? single?.setCode;
  const collectorNumber = missing
    ? entry.slot.collectorNumber
    : nonfoil?.collectorNumber ?? foilCard?.collectorNumber ?? single?.collectorNumber;
  const foilArt = single ? single.foil : !nonfoil && !!foilCard;
  const muted = missing;
  const addingNonfoil = addingFinish?.scryfallId === scryfallId && addingFinish.foil === false;
  const addingFoil = addingFinish?.scryfallId === scryfallId && addingFinish.foil === true;
  const adding = addingNonfoil || addingFoil;
  const ownedId = nonfoil?.id ?? foilCard?.id ?? single?.id ?? null;
  const showFinishes = !single;
  const nameColor = muted ? colors.textTertiary : colors.text;
  const captionColor = muted ? colors.textTertiary : colors.textSecondary;

  const setGrid = offerUnowned && layout === 'grid';
  const onImage = setGrid
    ? ownedId
      ? () => onOpen(ownedId)
      : undefined
    : ownedId
      ? () => onOpen(ownedId)
      : writer && onAdd && !adding
        ? () => onAdd(scryfallId, false)
        : undefined;

  const imageLabel = muted
    ? adding
      ? `${name}, adding`
      : writer
        ? `${name}, not owned, add non-foil`
        : `${name}, not owned`
    : `${name}, ${
        single
          ? single.qty
          : [nonfoil ? `${nonfoil.qty} non-foil` : null, foilCard ? `${foilCard.qty} foil` : null].filter(Boolean).join(', ')
      }`;

  const art = (
    <MtgCardImage
      uri={imageUri}
      backUri={backUri}
      title={name}
      foil={foilArt}
      muted={muted}
      style={layout === 'grid' ? styles.bookCover : styles.mtgThumb}
      onPress={onImage}
      accessibilityLabel={onImage ? imageLabel : undefined}
      placeholderColor={colors.surfaceElevated}
      placeholderTextColor={colors.textTertiary}
    />
  );

  const artFrame = (
    <View style={layout === 'grid' ? styles.artFrame : undefined}>
      {art}
      {adding && !showFinishes ? <ActivityIndicator color={colors.accent} style={styles.adding} /> : null}
    </View>
  );

  const finishes = showFinishes ? (
    <View style={styles.counts}>
      {offerUnowned || nonfoil ? (
        <FinishCount
          name={name}
          qty={nonfoil?.qty ?? 0}
          foil={false}
          adding={addingNonfoil}
          canAdd={writer && offerUnowned}
          color={nonfoil ? colors.textSecondary : writer && offerUnowned ? colors.accent : colors.textTertiary}
          onOpen={onOpen}
          onAdd={onAdd}
          cardId={nonfoil?.id ?? null}
          scryfallId={scryfallId}
        />
      ) : null}
      {offerUnowned || foilCard ? (
        <FinishCount
          name={name}
          qty={foilCard?.qty ?? 0}
          foil
          adding={addingFoil}
          canAdd={writer && offerUnowned}
          color={foilCard ? colors.textSecondary : writer && offerUnowned ? colors.accent : colors.textTertiary}
          onOpen={onOpen}
          onAdd={onAdd}
          cardId={foilCard?.id ?? null}
          scryfallId={scryfallId}
        />
      ) : null}
    </View>
  ) : (
    <Text style={[typeScale.caption, { color: captionColor }]}>{`Qty ${single?.qty ?? 0}`}</Text>
  );

  const metaLine = [setCode?.toUpperCase(), collectorNumber].filter(Boolean).join(' · ');

  const rowStyle =
    layout === 'grid'
      ? [styles.bookItem, compact && styles.bookItemCompact]
      : [
          styles.mtgRow,
          compact && styles.listRowCompact,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ];

  if (single) {
    const details = (
      <>
        <Text style={layout === 'grid' ? [styles.bookTitle, { color: nameColor }] : [typeScale.body, { color: nameColor, fontWeight: '600' }]} numberOfLines={2}>
          {name}
          {single.foil ? ' ★' : ''}
        </Text>
        {layout === 'list' && metaLine ? (
          <Text style={[typeScale.caption, { color: captionColor }]} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
        {finishes}
      </>
    );
    return (
      <View style={rowStyle}>
        {artFrame}
        <Pressable
          onPress={() => onOpen(single.id)}
          accessibilityRole="button"
          accessibilityLabel={imageLabel}
          style={({ pressed }) => [layout === 'list' ? styles.singleBody : undefined, pressed && { opacity: 0.85 }]}
        >
          {layout === 'list' ? <View style={styles.listMeta}>{details}</View> : details}
          {layout === 'list' ? <ChevronIcon color={colors.textTertiary} /> : null}
        </Pressable>
      </View>
    );
  }

  const image = (
    <View accessibilityLabel={onImage ? undefined : imageLabel} style={layout === 'grid' ? styles.artFrame : undefined}>
      {artFrame}
    </View>
  );

  const framed =
    layout === 'grid' ? (
      <>
        {image}
        {setGrid ? (
          <>
            <Text style={[styles.bookTitle, styles.setTitle, { color: nameColor }]} numberOfLines={2}>
              {collectorNumber ? `${collectorNumber} : ${name}` : name}
            </Text>
            <View style={styles.stepperRow}>
              <SetFinishStepper
                name={name}
                card={nonfoil}
                foil={false}
                busy={adding}
                editable={nonfoil != null && (canAdjust?.(nonfoil) ?? false)}
                canAdd={writer && offerUnowned && nonfoil == null}
                onAdd={onAdd ? () => onAdd(scryfallId, false) : undefined}
                onAdjust={onAdjust}
              />
              <View style={[styles.stepperRule, { backgroundColor: colors.border }]} />
              <SetFinishStepper
                name={name}
                card={foilCard}
                foil
                busy={adding}
                editable={foilCard != null && (canAdjust?.(foilCard) ?? false)}
                canAdd={writer && offerUnowned && foilCard == null}
                onAdd={onAdd ? () => onAdd(scryfallId, true) : undefined}
                onAdjust={onAdjust}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.bookTitle, { color: nameColor }]} numberOfLines={2}>
              {name}
            </Text>
            {muted && collectorNumber ? (
              <Text style={[typeScale.caption, { color: captionColor }]}>{collectorNumber}</Text>
            ) : null}
            {finishes}
          </>
        )}
      </>
    ) : (
      <>
        {image}
        <View style={styles.listMeta}>
          <Text style={[typeScale.body, { color: nameColor, fontWeight: '600' }]} numberOfLines={2}>
            {name}
          </Text>
          {metaLine ? (
            <Text style={[typeScale.caption, { color: captionColor }]} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
          {finishes}
        </View>
        {ownedId ? (
          <Pressable
            onPress={() => onOpen(ownedId)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${name}`}
            hitSlop={8}
          >
            <ChevronIcon color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </>
    );

  return <View style={rowStyle}>{framed}</View>;
}

export function MtgCollectionResults({
  cards,
  entries,
  screen,
  writer,
  layout,
  compact,
  colorCounts,
  copies,
  printings,
  setCount,
  sets,
  filtering,
  onOpenSet,
  onOpenAll,
  selectedColor,
  onSelectColor,
  onAddFinish,
  onAdjustFinish,
  canAdjustFinish,
  addingFinish = null,
  emptyAction,
  bottomPad,
  refreshing,
  onRefresh,
  footer,
}: MtgCollectionResultsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const listPad = { paddingBottom: bottomPad };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
  );

  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards yet"
        message={writer ? 'Add a card from Scryfall.' : 'Cards added by your household will show up here.'}
        action={emptyAction}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  if (screen === 'overview') {
    return (
      <MtgCollectionOverview
        colorCounts={colorCounts}
        copies={copies}
        printings={printings}
        setCount={setCount}
        sets={sets}
        onOpenSet={onOpenSet}
        onOpenAll={onOpenAll}
        onSelectColor={onSelectColor}
        bottomPad={bottomPad}
        filtering={filtering}
        refreshing={refreshing}
        onRefresh={onRefresh}
        footer={footer}
      />
    );
  }

  if (entries.length === 0 && screen !== 'all') {
    return (
      <EmptyState
        title="No matches"
        message="Try another name, or go back to the collection overview."
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  const colorHeader =
    screen === 'all' && colorCounts ? (
      <View style={styles.colorHeader}>
        <ManaSymbolRow counts={colorCounts} selected={selectedColor} onSelect={onSelectColor} />
      </View>
    ) : null;

  return (
    <FlatList
      key={layout === 'grid' ? 'mtg-grid' : 'mtg-list'}
      data={entries}
      extraData={addingFinish}
      keyExtractor={(item) =>
        item.kind === 'owned'
          ? item.card.id
          : item.kind === 'missing'
            ? `missing-${item.slot.scryfallId}`
            : (item.nonfoil?.id ?? item.foil?.id ?? 'printing')
      }
      numColumns={layout === 'grid' ? 2 : 1}
      keyboardDismissMode="on-drag"
      refreshControl={refreshControl}
      columnWrapperStyle={layout === 'grid' ? styles.row : undefined}
      contentContainerStyle={layout === 'grid' ? [styles.grid, listPad] : [styles.list, listPad]}
      ListHeaderComponent={colorHeader}
      ListEmptyComponent={
        <Text style={[typeScale.body, { color: colors.textSecondary, paddingVertical: spacing.md }]}>
          {selectedColor
            ? 'No matches. Try another name, or choose another color.'
            : 'No matches. Try another name, or go back to the collection overview.'}
        </Text>
      }
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) => (
        <ChecklistRow
          entry={item}
          layout={layout}
          compact={compact}
          writer={writer}
          addingFinish={addingFinish}
          offerUnowned={screen === 'set'}
          onOpen={(id) => router.push(`/mtg/card/${id}`)}
          onAdd={onAddFinish}
          onAdjust={onAdjustFinish}
          canAdjust={canAdjustFinish}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.sm,
  },
  row: { justifyContent: 'space-between' },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  colorHeader: {
    marginBottom: spacing.sm,
  },
  listRowCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listMeta: { flex: 1, gap: 2 },
  singleBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bookItem: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '50%',
    gap: 4,
  },
  bookItemCompact: {
    margin: spacing.xs,
  },
  artFrame: {
    width: '100%',
  },
  bookCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  adding: {
    ...StyleSheet.absoluteFill,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  setTitle: {
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  stepperHalf: {
    flex: 1,
    gap: 2,
  },
  stepperLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  stepperButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSign: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepperCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  stepperRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  mtgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  mtgThumb: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
});
